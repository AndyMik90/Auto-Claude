"""
TypeScript/JavaScript AST Extractor
====================================

Multi-layer AST extraction for TypeScript and JavaScript source files.
Uses regex-based parsing as a fallback when tree-sitter is not available.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .base import BaseExtractor
from ..models import (
    FunctionSignature,
    ClassSignature,
    ImportInfo,
    ParameterInfo,
    CallGraphEdge,
    ControlFlowNode,
    DataFlowEdge,
    DependencySlice,
)


class TypeScriptExtractor(BaseExtractor):
    """
    TypeScript/JavaScript extractor using regex-based parsing.

    For production use, consider integrating tree-sitter-typescript
    for more accurate parsing.
    """

    extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]
    language = "typescript"

    def can_handle(self, file_path: Path) -> bool:
        return file_path.suffix in self.extensions

    def extract_l1_ast(self, source: str, file_path: Path) -> dict[str, Any]:
        """Extract L1: Functions, classes, imports, signatures."""
        imports = self._extract_imports(source)
        functions = self._extract_functions(source)
        classes = self._extract_classes(source)
        interfaces = self._extract_interfaces(source)
        types = self._extract_type_aliases(source)

        # Combine interfaces and types as class-like structures
        for iface in interfaces:
            classes.append(iface)

        return {
            "imports": imports,
            "functions": functions,
            "classes": classes,
            "module_docstring": self._extract_module_doc(source),
            "global_variables": self._extract_exports(source),
        }

    def _extract_imports(self, source: str) -> list[ImportInfo]:
        """Extract import statements."""
        imports = []

        # ES6 imports: import { a, b } from 'module'
        es6_pattern = r"import\s+(?:\{([^}]+)\}|(\*)\s+as\s+(\w+)|(\w+))\s+from\s+['\"]([^'\"]+)['\"]"
        for match in re.finditer(es6_pattern, source):
            named = match.group(1)
            star = match.group(2)
            alias = match.group(3) or match.group(4)
            module = match.group(5)

            if named:
                names = [n.strip().split(" as ")[0] for n in named.split(",")]
                imports.append(ImportInfo(module=module, names=names))
            elif star:
                imports.append(ImportInfo(module=module, alias=alias))
            elif alias:
                imports.append(ImportInfo(module=module, alias=alias))

        # Default imports: import X from 'module'
        default_pattern = r"import\s+(\w+)\s+from\s+['\"]([^'\"]+)['\"]"
        for match in re.finditer(default_pattern, source):
            name = match.group(1)
            module = match.group(2)
            imports.append(ImportInfo(module=module, names=[name]))

        # CommonJS requires: const x = require('module')
        require_pattern = r"(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\(['\"]([^'\"]+)['\"]\)"
        for match in re.finditer(require_pattern, source):
            destructured = match.group(1)
            name = match.group(2)
            module = match.group(3)

            if destructured:
                names = [n.strip() for n in destructured.split(",")]
                imports.append(ImportInfo(module=module, names=names))
            else:
                imports.append(ImportInfo(module=module, alias=name))

        return imports

    def _extract_functions(self, source: str) -> list[FunctionSignature]:
        """Extract function declarations."""
        functions = []
        lines = source.splitlines()

        # Function declarations: function name(params): ReturnType
        func_pattern = r"(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)\s*(?::\s*([^\{]+))?"
        for match in re.finditer(func_pattern, source):
            name = match.group(1)
            params_str = match.group(2)
            return_type = match.group(3).strip() if match.group(3) else None

            line_start = source[: match.start()].count("\n") + 1
            is_async = "async" in match.group(0)

            params = self._parse_parameters(params_str)

            functions.append(
                FunctionSignature(
                    name=name,
                    parameters=params,
                    return_type=return_type,
                    is_async=is_async,
                    line_start=line_start,
                )
            )

        # Arrow functions: const name = (params) => or const name: Type = (params) =>
        arrow_pattern = r"(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*([^\s=]+))?\s*=>"
        for match in re.finditer(arrow_pattern, source):
            name = match.group(1)
            params_str = match.group(2)
            return_type = match.group(3) if match.group(3) else None

            line_start = source[: match.start()].count("\n") + 1
            is_async = "async" in match.group(0)

            params = self._parse_parameters(params_str)

            functions.append(
                FunctionSignature(
                    name=name,
                    parameters=params,
                    return_type=return_type,
                    is_async=is_async,
                    line_start=line_start,
                )
            )

        return functions

    def _extract_classes(self, source: str) -> list[ClassSignature]:
        """Extract class declarations."""
        classes = []

        # Class pattern: class Name extends Base implements Interface
        class_pattern = r"(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{"

        for match in re.finditer(class_pattern, source):
            name = match.group(1)
            extends = match.group(2)
            implements = match.group(3)

            bases = []
            if extends:
                bases.append(extends)
            if implements:
                bases.extend([i.strip() for i in implements.split(",")])

            line_start = source[: match.start()].count("\n") + 1

            # Find class body to extract methods
            class_start = match.end()
            class_body = self._extract_block(source, class_start - 1)

            methods = self._extract_methods(class_body)
            attributes = self._extract_class_attributes(class_body)

            is_abstract = "abstract" in match.group(0)

            classes.append(
                ClassSignature(
                    name=name,
                    bases=bases,
                    methods=methods,
                    attributes=attributes,
                    is_abstract=is_abstract,
                    line_start=line_start,
                )
            )

        return classes

    def _extract_interfaces(self, source: str) -> list[ClassSignature]:
        """Extract TypeScript interfaces as class-like structures."""
        interfaces = []

        interface_pattern = r"(?:export\s+)?interface\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+([^{]+))?\s*\{"

        for match in re.finditer(interface_pattern, source):
            name = match.group(1)
            extends = match.group(2)

            bases = []
            if extends:
                bases = [e.strip() for e in extends.split(",")]

            line_start = source[: match.start()].count("\n") + 1

            # Extract interface body
            body_start = match.end()
            body = self._extract_block(source, body_start - 1)

            # Parse interface members
            attributes = self._extract_interface_members(body)

            interfaces.append(
                ClassSignature(
                    name=name,
                    bases=bases,
                    decorators=["interface"],  # Mark as interface
                    attributes=attributes,
                    line_start=line_start,
                )
            )

        return interfaces

    def _extract_type_aliases(self, source: str) -> list[tuple[str, str]]:
        """Extract TypeScript type aliases."""
        types = []

        type_pattern = r"(?:export\s+)?type\s+(\w+)(?:<[^>]+>)?\s*=\s*([^;]+)"
        for match in re.finditer(type_pattern, source):
            name = match.group(1)
            definition = match.group(2).strip()[:100]  # Truncate long types
            types.append((name, definition))

        return types

    def _extract_methods(self, class_body: str) -> list[FunctionSignature]:
        """Extract methods from class body."""
        methods = []

        # Method patterns
        method_pattern = r"(?:(?:public|private|protected|static|async|readonly)\s+)*(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)\s*(?::\s*([^\{;]+))?"

        for match in re.finditer(method_pattern, class_body):
            name = match.group(1)
            if name in ("if", "for", "while", "switch", "catch", "constructor"):
                if name != "constructor":
                    continue

            params_str = match.group(2)
            return_type = match.group(3).strip() if match.group(3) else None

            params = self._parse_parameters(params_str)
            full_match = match.group(0)

            methods.append(
                FunctionSignature(
                    name=name,
                    parameters=params,
                    return_type=return_type,
                    is_method=True,
                    is_async="async" in full_match,
                    is_static="static" in full_match,
                )
            )

        return methods

    def _extract_class_attributes(
        self, class_body: str
    ) -> list[tuple[str, str | None]]:
        """Extract class properties/attributes."""
        attributes = []

        # Property patterns: modifiers name: Type
        prop_pattern = r"(?:(?:public|private|protected|readonly|static)\s+)*(\w+)\s*(?:\?)?:\s*([^;=]+)"

        for match in re.finditer(prop_pattern, class_body):
            name = match.group(1)
            type_hint = match.group(2).strip()

            # Skip if it looks like a method
            if "(" in type_hint:
                continue

            attributes.append((name, type_hint))

        return attributes

    def _extract_interface_members(
        self, body: str
    ) -> list[tuple[str, str | None]]:
        """Extract interface property definitions."""
        members = []

        # Interface member: name?: Type
        member_pattern = r"(\w+)\s*(\?)?\s*:\s*([^;,\n]+)"

        for match in re.finditer(member_pattern, body):
            name = match.group(1)
            type_hint = match.group(3).strip()
            members.append((name, type_hint))

        return members

    def _extract_exports(self, source: str) -> list[tuple[str, str | None]]:
        """Extract exported constants and variables."""
        exports = []

        # Export const/let/var
        export_pattern = r"export\s+(?:const|let|var)\s+(\w+)\s*(?::\s*([^=]+))?\s*="

        for match in re.finditer(export_pattern, source):
            name = match.group(1)
            type_hint = match.group(2).strip() if match.group(2) else None
            exports.append((name, type_hint))

        return exports

    def _extract_module_doc(self, source: str) -> str | None:
        """Extract module-level JSDoc comment."""
        # Look for leading JSDoc
        jsdoc_pattern = r"^\s*/\*\*([\s\S]*?)\*/\s*(?=import|export|const|let|var|function|class|interface|type)"
        match = re.search(jsdoc_pattern, source)
        if match:
            doc = match.group(1)
            # Clean up the JSDoc
            lines = [
                line.strip().lstrip("*").strip()
                for line in doc.splitlines()
            ]
            return " ".join(line for line in lines if line)[:200]
        return None

    def _parse_parameters(self, params_str: str) -> list[ParameterInfo]:
        """Parse function parameters string."""
        params = []
        if not params_str.strip():
            return params

        # Split by comma, but handle nested types
        param_parts = self._split_params(params_str)

        for part in param_parts:
            part = part.strip()
            if not part:
                continue

            # Handle rest parameters: ...args: Type[]
            is_variadic = part.startswith("...")
            if is_variadic:
                part = part[3:]

            # Split name and type
            if ":" in part:
                name_part, type_part = part.split(":", 1)
                name = name_part.strip().rstrip("?")
                type_hint = type_part.strip()
            else:
                name = part.split("=")[0].strip().rstrip("?")
                type_hint = None

            # Check for default value
            default = None
            if "=" in part:
                default = part.split("=", 1)[1].strip()

            params.append(
                ParameterInfo(
                    name=name,
                    type_hint=type_hint,
                    default=default,
                    is_variadic=is_variadic,
                )
            )

        return params

    def _split_params(self, params_str: str) -> list[str]:
        """Split parameters, respecting nested angle brackets and parentheses."""
        params = []
        current = []
        depth = 0

        for char in params_str:
            if char in "<([{":
                depth += 1
            elif char in ">)]}":
                depth -= 1
            elif char == "," and depth == 0:
                params.append("".join(current))
                current = []
                continue
            current.append(char)

        if current:
            params.append("".join(current))

        return params

    def _extract_block(self, source: str, start: int) -> str:
        """Extract a balanced block of code starting from a brace."""
        if start >= len(source) or source[start] != "{":
            return ""

        depth = 0
        end = start

        for i in range(start, len(source)):
            if source[i] == "{":
                depth += 1
            elif source[i] == "}":
                depth -= 1
                if depth == 0:
                    end = i
                    break

        return source[start + 1 : end]

    def extract_l2_call_graph(
        self,
        source: str,
        file_path: Path,
        functions: list[FunctionSignature],
        classes: list[ClassSignature],
    ) -> dict[str, Any]:
        """Extract L2: Call graph (simplified for regex-based approach)."""
        call_graph = []
        external_calls = set()

        # Build set of known local names
        local_names = {f.name for f in functions}
        for cls in classes:
            local_names.add(cls.name)

        # Simple call detection: name(
        call_pattern = r"\b(\w+)\s*\("

        lines = source.splitlines()
        current_function = None

        for i, line in enumerate(lines, 1):
            # Track current function context
            func_match = re.search(r"(?:function|const|let|var)\s+(\w+)", line)
            if func_match:
                current_function = func_match.group(1)

            # Find calls in this line
            for match in re.finditer(call_pattern, line):
                callee = match.group(1)

                # Skip keywords
                if callee in ("if", "for", "while", "switch", "catch", "return", "new", "typeof", "await"):
                    continue

                is_external = callee not in local_names
                if is_external:
                    external_calls.add(callee)

                if current_function:
                    call_graph.append(
                        CallGraphEdge(
                            caller=current_function,
                            callee=callee,
                            call_site_line=i,
                            is_external=is_external,
                        )
                    )

        return {
            "call_graph": call_graph,
            "external_calls": list(external_calls),
        }

    def extract_l3_control_flow(
        self,
        source: str,
        file_path: Path,
        functions: list[FunctionSignature],
    ) -> dict[str, list[ControlFlowNode]]:
        """Extract L3: Control flow graph (simplified)."""
        control_flow = {}
        current_function = None
        nodes: list[ControlFlowNode] = []
        node_id = 0

        lines = source.splitlines()

        for i, line in enumerate(lines, 1):
            # Track function boundaries
            func_match = re.search(r"(?:function|=>\s*\{?)\s*", line)
            name_match = re.search(r"(?:function|const|let|var)\s+(\w+)", line)

            if name_match:
                if current_function and nodes:
                    control_flow[current_function] = nodes
                current_function = name_match.group(1)
                nodes = []

            # Detect control flow structures
            if re.search(r"\bif\s*\(", line):
                node_id += 1
                cond_match = re.search(r"if\s*\(([^)]+)\)", line)
                cond = cond_match.group(1)[:50] if cond_match else None
                nodes.append(ControlFlowNode(id=f"n{node_id}", node_type="if", line=i, condition=cond))

            elif re.search(r"\belse\s+if\s*\(", line):
                node_id += 1
                nodes.append(ControlFlowNode(id=f"n{node_id}", node_type="else_if", line=i))

            elif re.search(r"\bfor\s*\(", line):
                node_id += 1
                nodes.append(ControlFlowNode(id=f"n{node_id}", node_type="for", line=i))

            elif re.search(r"\bwhile\s*\(", line):
                node_id += 1
                nodes.append(ControlFlowNode(id=f"n{node_id}", node_type="while", line=i))

            elif re.search(r"\bswitch\s*\(", line):
                node_id += 1
                nodes.append(ControlFlowNode(id=f"n{node_id}", node_type="switch", line=i))

            elif re.search(r"\btry\s*\{", line):
                node_id += 1
                nodes.append(ControlFlowNode(id=f"n{node_id}", node_type="try", line=i))

            elif re.search(r"\breturn\b", line):
                node_id += 1
                nodes.append(ControlFlowNode(id=f"n{node_id}", node_type="return", line=i))

            elif re.search(r"\bthrow\b", line):
                node_id += 1
                nodes.append(ControlFlowNode(id=f"n{node_id}", node_type="throw", line=i))

        # Save last function
        if current_function and nodes:
            control_flow[current_function] = nodes

        return control_flow

    def extract_l4_data_flow(
        self,
        source: str,
        file_path: Path,
        functions: list[FunctionSignature],
    ) -> dict[str, list[DataFlowEdge]]:
        """Extract L4: Data flow graph (simplified)."""
        data_flow = {}
        current_function = None
        definitions: dict[str, int] = {}
        edges: list[DataFlowEdge] = []

        lines = source.splitlines()

        for i, line in enumerate(lines, 1):
            # Track function boundaries
            name_match = re.search(r"(?:function|const|let|var)\s+(\w+)", line)
            if name_match and ("function" in line or "=>" in line):
                if current_function and edges:
                    data_flow[current_function] = edges
                current_function = name_match.group(1)
                definitions = {}
                edges = []

            # Track variable definitions
            def_match = re.search(r"\b(?:const|let|var)\s+(\w+)\s*=", line)
            if def_match:
                definitions[def_match.group(1)] = i

            # Track variable uses
            for var_name, def_line in definitions.items():
                if var_name in line and i > def_line:
                    # Check it's actually a use, not just in a string
                    use_pattern = rf"\b{re.escape(var_name)}\b"
                    if re.search(use_pattern, line):
                        edges.append(
                            DataFlowEdge(
                                variable=var_name,
                                definition_line=def_line,
                                use_line=i,
                            )
                        )

        # Save last function
        if current_function and edges:
            data_flow[current_function] = edges

        return data_flow

    def extract_l5_slices(
        self,
        source: str,
        file_path: Path,
        targets: list[tuple[str, int]] | None = None,
    ) -> list[DependencySlice]:
        """Extract L5: Program slices (simplified backward slice)."""
        slices = []
        lines = source.splitlines()

        # Auto-detect targets if not provided
        if targets is None:
            targets = []
            for i, line in enumerate(lines, 1):
                if "return " in line:
                    # Extract returned variable
                    match = re.search(r"return\s+(\w+)", line)
                    if match:
                        targets.append((match.group(1), i))

        for var_name, target_line in targets[:5]:
            backward_slice = []

            # Simple backward slice: find all definitions of this variable
            for i, line in enumerate(lines[:target_line], 1):
                if re.search(rf"\b{re.escape(var_name)}\s*=", line):
                    backward_slice.append(i)

            slices.append(
                DependencySlice(
                    target=var_name,
                    target_line=target_line,
                    backward_slice=backward_slice,
                    forward_slice=[],  # Simplified: not computing forward slice
                )
            )

        return slices
