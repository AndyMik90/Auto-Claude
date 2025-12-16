"""
Semantic Analyzer
=================

Analyzes code changes at a semantic level using tree-sitter.

This module provides AST-based analysis of code changes, extracting
meaningful semantic changes like "added import", "modified function",
"wrapped JSX element" rather than line-level diffs.

When tree-sitter is not available, falls back to regex-based heuristics.
"""

from __future__ import annotations

import difflib
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from .types import (
    ChangeType,
    FileAnalysis,
    SemanticChange,
    compute_content_hash,
)

# Import debug utilities
try:
    from debug import debug, debug_detailed, debug_verbose, debug_success, debug_error, is_debug_enabled
except ImportError:
    # Fallback if debug module not available
    def debug(*args, **kwargs): pass
    def debug_detailed(*args, **kwargs): pass
    def debug_verbose(*args, **kwargs): pass
    def debug_success(*args, **kwargs): pass
    def debug_error(*args, **kwargs): pass
    def is_debug_enabled(): return False

logger = logging.getLogger(__name__)
MODULE = "merge.semantic_analyzer"

# Try to import tree-sitter - it's optional but recommended
TREE_SITTER_AVAILABLE = False
try:
    import tree_sitter
    from tree_sitter import Language, Node, Parser, Tree

    TREE_SITTER_AVAILABLE = True
    logger.info("tree-sitter available, using AST-based analysis")
except ImportError:
    logger.warning("tree-sitter not available, using regex-based fallback")
    Tree = None
    Node = None

# Try to import language bindings
LANGUAGES_AVAILABLE: dict[str, Any] = {}
if TREE_SITTER_AVAILABLE:
    try:
        import tree_sitter_python as tspython

        LANGUAGES_AVAILABLE[".py"] = tspython.language()
    except ImportError:
        pass

    try:
        import tree_sitter_javascript as tsjs

        LANGUAGES_AVAILABLE[".js"] = tsjs.language()
        LANGUAGES_AVAILABLE[".jsx"] = tsjs.language()
    except ImportError:
        pass

    try:
        import tree_sitter_typescript as tsts

        LANGUAGES_AVAILABLE[".ts"] = tsts.language_typescript()
        LANGUAGES_AVAILABLE[".tsx"] = tsts.language_tsx()
    except ImportError:
        pass


@dataclass
class ExtractedElement:
    """A structural element extracted from code."""

    element_type: str  # function, class, import, variable, etc.
    name: str
    start_line: int
    end_line: int
    content: str
    parent: Optional[str] = None  # For nested elements (methods in classes)
    metadata: dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class SemanticAnalyzer:
    """
    Analyzes code changes at a semantic level.

    Uses tree-sitter for AST-based analysis when available,
    falling back to regex-based heuristics when not.

    Example:
        analyzer = SemanticAnalyzer()
        analysis = analyzer.analyze_diff("src/App.tsx", before_code, after_code)
        for change in analysis.changes:
            print(f"{change.change_type.value}: {change.target}")
    """

    def __init__(self):
        """Initialize the analyzer with available parsers."""
        self._parsers: dict[str, Parser] = {}

        debug(MODULE, "Initializing SemanticAnalyzer", tree_sitter_available=TREE_SITTER_AVAILABLE)

        if TREE_SITTER_AVAILABLE:
            for ext, lang in LANGUAGES_AVAILABLE.items():
                parser = Parser()
                parser.language = Language(lang)
                self._parsers[ext] = parser
                debug_detailed(MODULE, f"Initialized parser for {ext}")
            debug_success(MODULE, "SemanticAnalyzer initialized", parsers=list(self._parsers.keys()))
        else:
            debug(MODULE, "Using regex-based fallback (tree-sitter not available)")

    def analyze_diff(
        self,
        file_path: str,
        before: str,
        after: str,
        task_id: Optional[str] = None,
    ) -> FileAnalysis:
        """
        Analyze the semantic differences between two versions of a file.

        Args:
            file_path: Path to the file being analyzed
            before: Content before changes
            after: Content after changes
            task_id: Optional task ID for context

        Returns:
            FileAnalysis containing semantic changes
        """
        ext = Path(file_path).suffix.lower()

        debug(MODULE, f"Analyzing diff for {file_path}",
              file_path=file_path,
              extension=ext,
              before_length=len(before),
              after_length=len(after),
              task_id=task_id)

        # Use tree-sitter if available for this language
        if ext in self._parsers:
            debug_detailed(MODULE, f"Using tree-sitter parser for {ext}")
            analysis = self._analyze_with_tree_sitter(file_path, before, after, ext)
        else:
            debug_detailed(MODULE, f"Using regex fallback for {ext}")
            analysis = self._analyze_with_regex(file_path, before, after, ext)

        debug_success(MODULE, f"Analysis complete for {file_path}",
                      changes_found=len(analysis.changes),
                      functions_modified=len(analysis.functions_modified),
                      functions_added=len(analysis.functions_added),
                      imports_added=len(analysis.imports_added),
                      total_lines_changed=analysis.total_lines_changed)

        # Log each change at verbose level
        for change in analysis.changes:
            debug_verbose(MODULE, f"  Change: {change.change_type.value}",
                         target=change.target,
                         location=change.location,
                         lines=f"{change.line_start}-{change.line_end}")

        return analysis

    def _analyze_with_tree_sitter(
        self,
        file_path: str,
        before: str,
        after: str,
        ext: str,
    ) -> FileAnalysis:
        """Analyze using tree-sitter AST parsing."""
        parser = self._parsers[ext]

        tree_before = parser.parse(bytes(before, "utf-8"))
        tree_after = parser.parse(bytes(after, "utf-8"))

        # Extract structural elements from both versions
        elements_before = self._extract_elements(tree_before, before, ext)
        elements_after = self._extract_elements(tree_after, after, ext)

        # Compare and generate semantic changes
        changes = self._compare_elements(elements_before, elements_after, ext)

        # Build the analysis
        analysis = FileAnalysis(file_path=file_path, changes=changes)

        # Populate summary fields
        for change in changes:
            if change.change_type in {
                ChangeType.MODIFY_FUNCTION,
                ChangeType.ADD_HOOK_CALL,
            }:
                analysis.functions_modified.add(change.target)
            elif change.change_type == ChangeType.ADD_FUNCTION:
                analysis.functions_added.add(change.target)
            elif change.change_type == ChangeType.ADD_IMPORT:
                analysis.imports_added.add(change.target)
            elif change.change_type == ChangeType.REMOVE_IMPORT:
                analysis.imports_removed.add(change.target)
            elif change.change_type in {
                ChangeType.MODIFY_CLASS,
                ChangeType.ADD_METHOD,
            }:
                analysis.classes_modified.add(change.target.split(".")[0])

            analysis.total_lines_changed += change.line_end - change.line_start + 1

        return analysis

    def _extract_elements(
        self,
        tree: Tree,
        source: str,
        ext: str,
    ) -> dict[str, ExtractedElement]:
        """Extract structural elements from a syntax tree."""
        elements: dict[str, ExtractedElement] = {}
        source_bytes = bytes(source, "utf-8")
        source_lines = source.split("\n")

        def get_text(node: Node) -> str:
            return source_bytes[node.start_byte : node.end_byte].decode("utf-8")

        def get_line(byte_pos: int) -> int:
            # Convert byte position to line number (1-indexed)
            return source[:byte_pos].count("\n") + 1

        # Language-specific extraction
        if ext == ".py":
            self._extract_python_elements(tree.root_node, elements, get_text, get_line)
        elif ext in {".js", ".jsx", ".ts", ".tsx"}:
            self._extract_js_elements(tree.root_node, elements, get_text, get_line, ext)

        return elements

    def _extract_python_elements(
        self,
        node: Node,
        elements: dict[str, ExtractedElement],
        get_text: callable,
        get_line: callable,
        parent: Optional[str] = None,
    ):
        """Extract elements from Python AST."""
        for child in node.children:
            if child.type == "import_statement":
                # import x, y
                text = get_text(child)
                # Extract module names
                for name_node in child.children:
                    if name_node.type == "dotted_name":
                        name = get_text(name_node)
                        elements[f"import:{name}"] = ExtractedElement(
                            element_type="import",
                            name=name,
                            start_line=get_line(child.start_byte),
                            end_line=get_line(child.end_byte),
                            content=text,
                        )

            elif child.type == "import_from_statement":
                # from x import y, z
                text = get_text(child)
                module = None
                for sub in child.children:
                    if sub.type == "dotted_name":
                        module = get_text(sub)
                        break
                if module:
                    elements[f"import_from:{module}"] = ExtractedElement(
                        element_type="import_from",
                        name=module,
                        start_line=get_line(child.start_byte),
                        end_line=get_line(child.end_byte),
                        content=text,
                    )

            elif child.type == "function_definition":
                name_node = child.child_by_field_name("name")
                if name_node:
                    name = get_text(name_node)
                    full_name = f"{parent}.{name}" if parent else name
                    elements[f"function:{full_name}"] = ExtractedElement(
                        element_type="function",
                        name=full_name,
                        start_line=get_line(child.start_byte),
                        end_line=get_line(child.end_byte),
                        content=get_text(child),
                        parent=parent,
                    )

            elif child.type == "class_definition":
                name_node = child.child_by_field_name("name")
                if name_node:
                    name = get_text(name_node)
                    elements[f"class:{name}"] = ExtractedElement(
                        element_type="class",
                        name=name,
                        start_line=get_line(child.start_byte),
                        end_line=get_line(child.end_byte),
                        content=get_text(child),
                    )
                    # Recurse into class body for methods
                    body = child.child_by_field_name("body")
                    if body:
                        self._extract_python_elements(
                            body, elements, get_text, get_line, parent=name
                        )

            elif child.type == "decorated_definition":
                # Handle decorated functions/classes
                for sub in child.children:
                    if sub.type in {"function_definition", "class_definition"}:
                        self._extract_python_elements(
                            child, elements, get_text, get_line, parent
                        )
                        break

            # Recurse for other compound statements
            elif child.type in {"if_statement", "while_statement", "for_statement", "try_statement", "with_statement"}:
                self._extract_python_elements(child, elements, get_text, get_line, parent)

    def _extract_js_elements(
        self,
        node: Node,
        elements: dict[str, ExtractedElement],
        get_text: callable,
        get_line: callable,
        ext: str,
        parent: Optional[str] = None,
    ):
        """Extract elements from JavaScript/TypeScript AST."""
        for child in node.children:
            if child.type == "import_statement":
                text = get_text(child)
                # Try to extract the source module
                source_node = child.child_by_field_name("source")
                if source_node:
                    source = get_text(source_node).strip("'\"")
                    elements[f"import:{source}"] = ExtractedElement(
                        element_type="import",
                        name=source,
                        start_line=get_line(child.start_byte),
                        end_line=get_line(child.end_byte),
                        content=text,
                    )

            elif child.type in {"function_declaration", "function"}:
                name_node = child.child_by_field_name("name")
                if name_node:
                    name = get_text(name_node)
                    full_name = f"{parent}.{name}" if parent else name
                    elements[f"function:{full_name}"] = ExtractedElement(
                        element_type="function",
                        name=full_name,
                        start_line=get_line(child.start_byte),
                        end_line=get_line(child.end_byte),
                        content=get_text(child),
                        parent=parent,
                    )

            elif child.type == "arrow_function":
                # Arrow functions are usually assigned to variables
                # We'll catch these via variable declarations
                pass

            elif child.type in {"lexical_declaration", "variable_declaration"}:
                # const/let/var declarations
                for declarator in child.children:
                    if declarator.type == "variable_declarator":
                        name_node = declarator.child_by_field_name("name")
                        value_node = declarator.child_by_field_name("value")
                        if name_node:
                            name = get_text(name_node)
                            content = get_text(child)

                            # Check if it's a function (arrow function or function expression)
                            is_function = False
                            if value_node and value_node.type in {
                                "arrow_function",
                                "function",
                            }:
                                is_function = True
                                elements[f"function:{name}"] = ExtractedElement(
                                    element_type="function",
                                    name=name,
                                    start_line=get_line(child.start_byte),
                                    end_line=get_line(child.end_byte),
                                    content=content,
                                    parent=parent,
                                )
                            else:
                                elements[f"variable:{name}"] = ExtractedElement(
                                    element_type="variable",
                                    name=name,
                                    start_line=get_line(child.start_byte),
                                    end_line=get_line(child.end_byte),
                                    content=content,
                                    parent=parent,
                                )

            elif child.type == "class_declaration":
                name_node = child.child_by_field_name("name")
                if name_node:
                    name = get_text(name_node)
                    elements[f"class:{name}"] = ExtractedElement(
                        element_type="class",
                        name=name,
                        start_line=get_line(child.start_byte),
                        end_line=get_line(child.end_byte),
                        content=get_text(child),
                    )
                    # Recurse into class body
                    body = child.child_by_field_name("body")
                    if body:
                        self._extract_js_elements(
                            body, elements, get_text, get_line, ext, parent=name
                        )

            elif child.type == "method_definition":
                name_node = child.child_by_field_name("name")
                if name_node:
                    name = get_text(name_node)
                    full_name = f"{parent}.{name}" if parent else name
                    elements[f"method:{full_name}"] = ExtractedElement(
                        element_type="method",
                        name=full_name,
                        start_line=get_line(child.start_byte),
                        end_line=get_line(child.end_byte),
                        content=get_text(child),
                        parent=parent,
                    )

            elif child.type == "export_statement":
                # Recurse into exports to find the actual declaration
                self._extract_js_elements(
                    child, elements, get_text, get_line, ext, parent
                )

            # TypeScript specific
            elif child.type in {"interface_declaration", "type_alias_declaration"}:
                name_node = child.child_by_field_name("name")
                if name_node:
                    name = get_text(name_node)
                    elem_type = "interface" if "interface" in child.type else "type"
                    elements[f"{elem_type}:{name}"] = ExtractedElement(
                        element_type=elem_type,
                        name=name,
                        start_line=get_line(child.start_byte),
                        end_line=get_line(child.end_byte),
                        content=get_text(child),
                    )

            # Recurse into statement blocks
            elif child.type in {"program", "statement_block", "class_body"}:
                self._extract_js_elements(
                    child, elements, get_text, get_line, ext, parent
                )

    def _compare_elements(
        self,
        before: dict[str, ExtractedElement],
        after: dict[str, ExtractedElement],
        ext: str,
    ) -> list[SemanticChange]:
        """Compare extracted elements to generate semantic changes."""
        changes: list[SemanticChange] = []

        all_keys = set(before.keys()) | set(after.keys())

        for key in all_keys:
            elem_before = before.get(key)
            elem_after = after.get(key)

            if elem_before and not elem_after:
                # Element was removed
                change_type = self._get_remove_change_type(elem_before.element_type)
                changes.append(
                    SemanticChange(
                        change_type=change_type,
                        target=elem_before.name,
                        location=self._get_location(elem_before),
                        line_start=elem_before.start_line,
                        line_end=elem_before.end_line,
                        content_before=elem_before.content,
                        content_after=None,
                    )
                )

            elif not elem_before and elem_after:
                # Element was added
                change_type = self._get_add_change_type(elem_after.element_type)
                changes.append(
                    SemanticChange(
                        change_type=change_type,
                        target=elem_after.name,
                        location=self._get_location(elem_after),
                        line_start=elem_after.start_line,
                        line_end=elem_after.end_line,
                        content_before=None,
                        content_after=elem_after.content,
                    )
                )

            elif elem_before and elem_after:
                # Element exists in both - check if modified
                if elem_before.content != elem_after.content:
                    change_type = self._classify_modification(
                        elem_before, elem_after, ext
                    )
                    changes.append(
                        SemanticChange(
                            change_type=change_type,
                            target=elem_after.name,
                            location=self._get_location(elem_after),
                            line_start=elem_after.start_line,
                            line_end=elem_after.end_line,
                            content_before=elem_before.content,
                            content_after=elem_after.content,
                        )
                    )

        return changes

    def _get_add_change_type(self, element_type: str) -> ChangeType:
        """Map element type to add change type."""
        mapping = {
            "import": ChangeType.ADD_IMPORT,
            "import_from": ChangeType.ADD_IMPORT,
            "function": ChangeType.ADD_FUNCTION,
            "class": ChangeType.ADD_CLASS,
            "method": ChangeType.ADD_METHOD,
            "variable": ChangeType.ADD_VARIABLE,
            "interface": ChangeType.ADD_INTERFACE,
            "type": ChangeType.ADD_TYPE,
        }
        return mapping.get(element_type, ChangeType.UNKNOWN)

    def _get_remove_change_type(self, element_type: str) -> ChangeType:
        """Map element type to remove change type."""
        mapping = {
            "import": ChangeType.REMOVE_IMPORT,
            "import_from": ChangeType.REMOVE_IMPORT,
            "function": ChangeType.REMOVE_FUNCTION,
            "class": ChangeType.REMOVE_CLASS,
            "method": ChangeType.REMOVE_METHOD,
            "variable": ChangeType.REMOVE_VARIABLE,
        }
        return mapping.get(element_type, ChangeType.UNKNOWN)

    def _get_location(self, element: ExtractedElement) -> str:
        """Generate a location string for an element."""
        if element.parent:
            return f"{element.element_type}:{element.parent}.{element.name.split('.')[-1]}"
        return f"{element.element_type}:{element.name}"

    def _classify_modification(
        self,
        before: ExtractedElement,
        after: ExtractedElement,
        ext: str,
    ) -> ChangeType:
        """Classify what kind of modification was made."""
        element_type = after.element_type

        if element_type == "import":
            return ChangeType.MODIFY_IMPORT

        if element_type in {"function", "method"}:
            # Analyze the function content for specific changes
            return self._classify_function_modification(before.content, after.content, ext)

        if element_type == "class":
            return ChangeType.MODIFY_CLASS

        if element_type == "interface":
            return ChangeType.MODIFY_INTERFACE

        if element_type == "type":
            return ChangeType.MODIFY_TYPE

        if element_type == "variable":
            return ChangeType.MODIFY_VARIABLE

        return ChangeType.UNKNOWN

    def _classify_function_modification(
        self,
        before: str,
        after: str,
        ext: str,
    ) -> ChangeType:
        """Classify what changed in a function."""
        # Check for React hook additions
        hook_pattern = r"\buse[A-Z]\w*\s*\("
        hooks_before = set(re.findall(hook_pattern, before))
        hooks_after = set(re.findall(hook_pattern, after))

        if hooks_after - hooks_before:
            return ChangeType.ADD_HOOK_CALL
        if hooks_before - hooks_after:
            return ChangeType.REMOVE_HOOK_CALL

        # Check for JSX wrapping (more JSX elements in after)
        jsx_pattern = r"<[A-Z]\w*"
        jsx_before = len(re.findall(jsx_pattern, before))
        jsx_after = len(re.findall(jsx_pattern, after))

        if jsx_after > jsx_before:
            return ChangeType.WRAP_JSX
        if jsx_after < jsx_before:
            return ChangeType.UNWRAP_JSX

        # Check if only JSX props changed
        if ext in {".jsx", ".tsx"}:
            # Simplified check - if the structure is same but content differs
            struct_before = re.sub(r'=\{[^}]*\}|="[^"]*"', "=...", before)
            struct_after = re.sub(r'=\{[^}]*\}|="[^"]*"', "=...", after)
            if struct_before == struct_after:
                return ChangeType.MODIFY_JSX_PROPS

        return ChangeType.MODIFY_FUNCTION

    def _analyze_with_regex(
        self,
        file_path: str,
        before: str,
        after: str,
        ext: str,
    ) -> FileAnalysis:
        """Fallback analysis using regex when tree-sitter isn't available."""
        changes: list[SemanticChange] = []

        # Get a unified diff
        diff = list(
            difflib.unified_diff(
                before.splitlines(keepends=True),
                after.splitlines(keepends=True),
                lineterm="",
            )
        )

        # Analyze the diff for patterns
        added_lines: list[tuple[int, str]] = []
        removed_lines: list[tuple[int, str]] = []
        current_line = 0

        for line in diff:
            if line.startswith("@@"):
                # Parse the line numbers
                match = re.match(r"@@ -\d+(?:,\d+)? \+(\d+)", line)
                if match:
                    current_line = int(match.group(1))
            elif line.startswith("+") and not line.startswith("+++"):
                added_lines.append((current_line, line[1:]))
                current_line += 1
            elif line.startswith("-") and not line.startswith("---"):
                removed_lines.append((current_line, line[1:]))
            elif not line.startswith("-"):
                current_line += 1

        # Detect imports
        import_pattern = self._get_import_pattern(ext)
        for line_num, line in added_lines:
            if import_pattern and import_pattern.match(line.strip()):
                changes.append(
                    SemanticChange(
                        change_type=ChangeType.ADD_IMPORT,
                        target=line.strip(),
                        location="file_top",
                        line_start=line_num,
                        line_end=line_num,
                        content_after=line,
                    )
                )

        for line_num, line in removed_lines:
            if import_pattern and import_pattern.match(line.strip()):
                changes.append(
                    SemanticChange(
                        change_type=ChangeType.REMOVE_IMPORT,
                        target=line.strip(),
                        location="file_top",
                        line_start=line_num,
                        line_end=line_num,
                        content_before=line,
                    )
                )

        # Detect function changes (simplified)
        func_pattern = self._get_function_pattern(ext)
        if func_pattern:
            funcs_before = set(func_pattern.findall(before))
            funcs_after = set(func_pattern.findall(after))

            for func in funcs_after - funcs_before:
                changes.append(
                    SemanticChange(
                        change_type=ChangeType.ADD_FUNCTION,
                        target=func,
                        location=f"function:{func}",
                        line_start=1,
                        line_end=1,
                    )
                )

            for func in funcs_before - funcs_after:
                changes.append(
                    SemanticChange(
                        change_type=ChangeType.REMOVE_FUNCTION,
                        target=func,
                        location=f"function:{func}",
                        line_start=1,
                        line_end=1,
                    )
                )

        # Build analysis
        analysis = FileAnalysis(file_path=file_path, changes=changes)

        for change in changes:
            if change.change_type == ChangeType.ADD_IMPORT:
                analysis.imports_added.add(change.target)
            elif change.change_type == ChangeType.REMOVE_IMPORT:
                analysis.imports_removed.add(change.target)
            elif change.change_type == ChangeType.ADD_FUNCTION:
                analysis.functions_added.add(change.target)
            elif change.change_type == ChangeType.MODIFY_FUNCTION:
                analysis.functions_modified.add(change.target)

        analysis.total_lines_changed = len(added_lines) + len(removed_lines)

        return analysis

    def _get_import_pattern(self, ext: str) -> Optional[re.Pattern]:
        """Get the import pattern for a file extension."""
        patterns = {
            ".py": re.compile(r"^(?:from\s+\S+\s+)?import\s+"),
            ".js": re.compile(r"^import\s+"),
            ".jsx": re.compile(r"^import\s+"),
            ".ts": re.compile(r"^import\s+"),
            ".tsx": re.compile(r"^import\s+"),
        }
        return patterns.get(ext)

    def _get_function_pattern(self, ext: str) -> Optional[re.Pattern]:
        """Get the function definition pattern for a file extension."""
        patterns = {
            ".py": re.compile(r"def\s+(\w+)\s*\("),
            ".js": re.compile(r"(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))"),
            ".jsx": re.compile(r"(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))"),
            ".ts": re.compile(r"(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*(?::\s*\w+)?\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))"),
            ".tsx": re.compile(r"(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*(?::\s*\w+)?\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))"),
        }
        return patterns.get(ext)

    def analyze_file(self, file_path: str, content: str) -> FileAnalysis:
        """
        Analyze a single file's structure (not a diff).

        Useful for capturing baseline state.

        Args:
            file_path: Path to the file
            content: File content

        Returns:
            FileAnalysis with structural elements (no changes, just structure)
        """
        # Analyze against empty string to get all elements as "additions"
        return self.analyze_diff(file_path, "", content)

    @property
    def supported_extensions(self) -> set[str]:
        """Get the set of supported file extensions."""
        if TREE_SITTER_AVAILABLE:
            # Tree-sitter extensions plus regex fallbacks
            return set(self._parsers.keys()) | {".py", ".js", ".jsx", ".ts", ".tsx"}
        else:
            # Only regex-supported extensions
            return {".py", ".js", ".jsx", ".ts", ".tsx"}

    def is_supported(self, file_path: str) -> bool:
        """Check if a file type is supported for semantic analysis."""
        ext = Path(file_path).suffix.lower()
        return ext in self.supported_extensions
