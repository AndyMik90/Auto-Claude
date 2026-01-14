"""
Python AST Extractor
====================

Multi-layer AST extraction for Python source files.
"""

from __future__ import annotations

import ast
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


class PythonExtractor(BaseExtractor):
    """Python-specific AST extractor using the built-in ast module."""

    extensions = [".py", ".pyi"]
    language = "python"

    def can_handle(self, file_path: Path) -> bool:
        return file_path.suffix in self.extensions

    def extract_l1_ast(self, source: str, file_path: Path) -> dict[str, Any]:
        """Extract L1: Functions, classes, imports, signatures."""
        try:
            tree = ast.parse(source)
        except SyntaxError as e:
            return {
                "imports": [],
                "functions": [],
                "classes": [],
                "module_docstring": None,
                "global_variables": [],
                "error": str(e),
            }

        imports = self._extract_imports(tree)
        functions = self._extract_functions(tree, source)
        classes = self._extract_classes(tree, source)
        module_docstring = ast.get_docstring(tree)
        global_variables = self._extract_global_variables(tree)

        return {
            "imports": imports,
            "functions": functions,
            "classes": classes,
            "module_docstring": module_docstring,
            "global_variables": global_variables,
        }

    def _extract_imports(self, tree: ast.Module) -> list[ImportInfo]:
        """Extract all import statements."""
        imports = []

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(
                        ImportInfo(
                            module=alias.name,
                            alias=alias.asname,
                            is_relative=False,
                        )
                    )
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                names = [alias.name for alias in node.names]
                imports.append(
                    ImportInfo(
                        module=module,
                        names=names,
                        is_relative=node.level > 0,
                        level=node.level,
                    )
                )

        return imports

    def _extract_functions(
        self, tree: ast.Module, source: str
    ) -> list[FunctionSignature]:
        """Extract top-level function definitions."""
        functions = []
        source_lines = source.splitlines()

        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                func = self._parse_function(node, source_lines, is_method=False)
                functions.append(func)

        return functions

    def _extract_classes(self, tree: ast.Module, source: str) -> list[ClassSignature]:
        """Extract class definitions with their methods."""
        classes = []
        source_lines = source.splitlines()

        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                cls = self._parse_class(node, source_lines)
                classes.append(cls)

        return classes

    def _parse_function(
        self,
        node: ast.FunctionDef | ast.AsyncFunctionDef,
        source_lines: list[str],
        is_method: bool = False,
    ) -> FunctionSignature:
        """Parse a function node into FunctionSignature."""
        parameters = self._extract_parameters(node.args)
        return_type = self._get_annotation_str(node.returns) if node.returns else None
        decorators = [self._get_decorator_name(d) for d in node.decorator_list]
        docstring = ast.get_docstring(node)

        # Detect generator
        is_generator = any(
            isinstance(n, (ast.Yield, ast.YieldFrom)) for n in ast.walk(node)
        )

        # Detect special method types
        is_static = "staticmethod" in decorators
        is_classmethod = "classmethod" in decorators
        is_property = "property" in decorators

        # Calculate cyclomatic complexity
        complexity = self._calculate_complexity(node)

        return FunctionSignature(
            name=node.name,
            parameters=parameters,
            return_type=return_type,
            decorators=decorators,
            docstring=docstring[:200] if docstring else None,
            is_async=isinstance(node, ast.AsyncFunctionDef),
            is_generator=is_generator,
            is_method=is_method,
            is_static=is_static,
            is_classmethod=is_classmethod,
            is_property=is_property,
            line_start=node.lineno,
            line_end=node.end_lineno or node.lineno,
            complexity=complexity,
        )

    def _parse_class(
        self, node: ast.ClassDef, source_lines: list[str]
    ) -> ClassSignature:
        """Parse a class node into ClassSignature."""
        bases = [self._get_annotation_str(b) for b in node.bases]
        decorators = [self._get_decorator_name(d) for d in node.decorator_list]
        docstring = ast.get_docstring(node)

        # Detect special class types
        is_dataclass = "dataclass" in decorators
        is_abstract = any(
            "ABC" in b or "Abstract" in b for b in bases
        )

        # Extract methods
        methods = []
        for item in node.body:
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                method = self._parse_function(item, source_lines, is_method=True)
                methods.append(method)

        # Extract class attributes
        attributes = self._extract_class_attributes(node)

        return ClassSignature(
            name=node.name,
            bases=bases,
            decorators=decorators,
            docstring=docstring[:200] if docstring else None,
            methods=methods,
            attributes=attributes,
            is_dataclass=is_dataclass,
            is_abstract=is_abstract,
            line_start=node.lineno,
            line_end=node.end_lineno or node.lineno,
        )

    def _extract_parameters(self, args: ast.arguments) -> list[ParameterInfo]:
        """Extract function parameters."""
        params = []

        # Regular args
        defaults_offset = len(args.args) - len(args.defaults)
        for i, arg in enumerate(args.args):
            default_idx = i - defaults_offset
            default = None
            if default_idx >= 0:
                default = self._get_default_str(args.defaults[default_idx])

            params.append(
                ParameterInfo(
                    name=arg.arg,
                    type_hint=self._get_annotation_str(arg.annotation)
                    if arg.annotation
                    else None,
                    default=default,
                )
            )

        # *args
        if args.vararg:
            params.append(
                ParameterInfo(
                    name=args.vararg.arg,
                    type_hint=self._get_annotation_str(args.vararg.annotation)
                    if args.vararg.annotation
                    else None,
                    is_variadic=True,
                )
            )

        # Keyword-only args
        kw_defaults_map = {
            i: d for i, d in enumerate(args.kw_defaults) if d is not None
        }
        for i, arg in enumerate(args.kwonlyargs):
            default = None
            if i in kw_defaults_map:
                default = self._get_default_str(kw_defaults_map[i])
            params.append(
                ParameterInfo(
                    name=arg.arg,
                    type_hint=self._get_annotation_str(arg.annotation)
                    if arg.annotation
                    else None,
                    default=default,
                )
            )

        # **kwargs
        if args.kwarg:
            params.append(
                ParameterInfo(
                    name=args.kwarg.arg,
                    type_hint=self._get_annotation_str(args.kwarg.annotation)
                    if args.kwarg.annotation
                    else None,
                    is_keyword=True,
                )
            )

        return params

    def _extract_class_attributes(
        self, node: ast.ClassDef
    ) -> list[tuple[str, str | None]]:
        """Extract class-level attributes."""
        attributes = []

        for item in node.body:
            # Annotated assignment: x: int = 5
            if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                type_hint = self._get_annotation_str(item.annotation)
                attributes.append((item.target.id, type_hint))

            # Simple assignment: x = 5 (no type hint)
            elif isinstance(item, ast.Assign):
                for target in item.targets:
                    if isinstance(target, ast.Name):
                        attributes.append((target.id, None))

        return attributes

    def _extract_global_variables(
        self, tree: ast.Module
    ) -> list[tuple[str, str | None]]:
        """Extract module-level variables."""
        variables = []

        for node in tree.body:
            if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
                type_hint = self._get_annotation_str(node.annotation)
                variables.append((node.target.id, type_hint))
            elif isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        # Skip dunder variables
                        if not target.id.startswith("__"):
                            variables.append((target.id, None))

        return variables

    def _get_annotation_str(self, node: ast.expr | None) -> str:
        """Convert annotation AST node to string."""
        if node is None:
            return "Any"

        try:
            return ast.unparse(node)
        except Exception:
            if isinstance(node, ast.Name):
                return node.id
            elif isinstance(node, ast.Constant):
                return repr(node.value)
            return "Any"

    def _get_default_str(self, node: ast.expr) -> str:
        """Convert default value AST node to string."""
        try:
            return ast.unparse(node)
        except Exception:
            if isinstance(node, ast.Constant):
                return repr(node.value)
            return "..."

    def _get_decorator_name(self, node: ast.expr) -> str:
        """Extract decorator name from AST node."""
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            return f"{self._get_decorator_name(node.value)}.{node.attr}"
        elif isinstance(node, ast.Call):
            return self._get_decorator_name(node.func)
        return "unknown"

    def _calculate_complexity(
        self, node: ast.FunctionDef | ast.AsyncFunctionDef
    ) -> int:
        """Calculate cyclomatic complexity of a function."""
        complexity = 1  # Base complexity

        for child in ast.walk(node):
            # Decision points add complexity
            if isinstance(child, (ast.If, ast.While, ast.For, ast.AsyncFor)):
                complexity += 1
            elif isinstance(child, ast.ExceptHandler):
                complexity += 1
            elif isinstance(child, (ast.With, ast.AsyncWith)):
                complexity += 1
            elif isinstance(child, ast.Assert):
                complexity += 1
            elif isinstance(child, ast.BoolOp):
                # and/or add complexity
                complexity += len(child.values) - 1
            elif isinstance(child, ast.comprehension):
                complexity += 1
                if child.ifs:
                    complexity += len(child.ifs)

        return complexity

    def extract_l2_call_graph(
        self,
        source: str,
        file_path: Path,
        functions: list[FunctionSignature],
        classes: list[ClassSignature],
    ) -> dict[str, Any]:
        """Extract L2: Call graph showing function relationships."""
        try:
            tree = ast.parse(source)
        except SyntaxError:
            return {"call_graph": [], "external_calls": []}

        call_graph = []
        external_calls = set()

        # Build set of known local names
        local_names = {f.name for f in functions}
        for cls in classes:
            local_names.add(cls.name)
            for method in cls.methods:
                local_names.add(f"{cls.name}.{method.name}")

        class CallVisitor(ast.NodeVisitor):
            def __init__(self, current_context: str):
                self.context = current_context

            def visit_Call(self, node: ast.Call):
                callee = self._get_call_target(node.func)
                if callee:
                    is_external = callee.split(".")[0] not in local_names
                    if is_external:
                        external_calls.add(callee.split(".")[0])
                    call_graph.append(
                        CallGraphEdge(
                            caller=self.context,
                            callee=callee,
                            call_site_line=node.lineno,
                            is_external=is_external,
                        )
                    )
                self.generic_visit(node)

            def _get_call_target(self, node: ast.expr) -> str | None:
                if isinstance(node, ast.Name):
                    return node.id
                elif isinstance(node, ast.Attribute):
                    base = self._get_call_target(node.value)
                    if base:
                        return f"{base}.{node.attr}"
                    return node.attr
                return None

        # Visit all functions and methods
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                context = node.name
                # Check if this is a method inside a class
                for parent in ast.walk(tree):
                    if isinstance(parent, ast.ClassDef) and node in parent.body:
                        context = f"{parent.name}.{node.name}"
                        break
                visitor = CallVisitor(context)
                visitor.visit(node)

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
        """Extract L3: Control flow graph for each function."""
        try:
            tree = ast.parse(source)
        except SyntaxError:
            return {}

        control_flow = {}

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                nodes = self._extract_cfg_nodes(node)
                control_flow[node.name] = nodes

        return control_flow

    def _extract_cfg_nodes(
        self, func_node: ast.FunctionDef | ast.AsyncFunctionDef
    ) -> list[ControlFlowNode]:
        """Extract control flow nodes from a function."""
        nodes = []
        node_id = 0

        def add_node(node_type: str, line: int, condition: str | None = None):
            nonlocal node_id
            node_id += 1
            nodes.append(
                ControlFlowNode(
                    id=f"n{node_id}",
                    node_type=node_type,
                    line=line,
                    condition=condition,
                )
            )

        for node in ast.walk(func_node):
            if isinstance(node, ast.If):
                cond = ast.unparse(node.test)[:50] if node.test else None
                add_node("if", node.lineno, cond)
            elif isinstance(node, ast.While):
                cond = ast.unparse(node.test)[:50] if node.test else None
                add_node("while", node.lineno, cond)
            elif isinstance(node, ast.For):
                add_node("for", node.lineno)
            elif isinstance(node, ast.AsyncFor):
                add_node("async_for", node.lineno)
            elif isinstance(node, ast.Try):
                add_node("try", node.lineno)
            elif isinstance(node, ast.With):
                add_node("with", node.lineno)
            elif isinstance(node, ast.AsyncWith):
                add_node("async_with", node.lineno)
            elif isinstance(node, ast.Match):
                add_node("match", node.lineno)
            elif isinstance(node, ast.Return):
                add_node("return", node.lineno)
            elif isinstance(node, ast.Raise):
                add_node("raise", node.lineno)

        return nodes

    def extract_l4_data_flow(
        self,
        source: str,
        file_path: Path,
        functions: list[FunctionSignature],
    ) -> dict[str, list[DataFlowEdge]]:
        """Extract L4: Data flow graph for each function."""
        try:
            tree = ast.parse(source)
        except SyntaxError:
            return {}

        data_flow = {}

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                edges = self._extract_data_flow_edges(node)
                data_flow[node.name] = edges

        return data_flow

    def _extract_data_flow_edges(
        self, func_node: ast.FunctionDef | ast.AsyncFunctionDef
    ) -> list[DataFlowEdge]:
        """Extract data flow edges (def-use chains) from a function."""
        edges = []
        definitions: dict[str, int] = {}  # var -> line

        class DataFlowVisitor(ast.NodeVisitor):
            def visit_Assign(self, node: ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        definitions[target.id] = node.lineno
                self.generic_visit(node)

            def visit_AnnAssign(self, node: ast.AnnAssign):
                if isinstance(node.target, ast.Name):
                    definitions[node.target.id] = node.lineno
                self.generic_visit(node)

            def visit_Name(self, node: ast.Name):
                if isinstance(node.ctx, ast.Load) and node.id in definitions:
                    edges.append(
                        DataFlowEdge(
                            variable=node.id,
                            definition_line=definitions[node.id],
                            use_line=node.lineno,
                        )
                    )
                self.generic_visit(node)

        visitor = DataFlowVisitor()
        visitor.visit(func_node)

        return edges

    def extract_l5_slices(
        self,
        source: str,
        file_path: Path,
        targets: list[tuple[str, int]] | None = None,
    ) -> list[DependencySlice]:
        """Extract L5: Program slices for key variables."""
        try:
            tree = ast.parse(source)
        except SyntaxError:
            return []

        slices = []

        # If no targets specified, find return statements and important assignments
        if targets is None:
            targets = []
            for node in ast.walk(tree):
                if isinstance(node, ast.Return) and node.value:
                    if isinstance(node.value, ast.Name):
                        targets.append((node.value.id, node.lineno))

        for var_name, target_line in targets[:5]:  # Limit for efficiency
            backward = self._compute_backward_slice(tree, var_name, target_line)
            forward = self._compute_forward_slice(tree, var_name, target_line)

            slices.append(
                DependencySlice(
                    target=var_name,
                    target_line=target_line,
                    backward_slice=backward,
                    forward_slice=forward,
                )
            )

        return slices

    def _compute_backward_slice(
        self, tree: ast.Module, var_name: str, target_line: int
    ) -> list[int]:
        """Compute backward slice: lines that affect the target variable."""
        affecting_lines = set()
        worklist = {var_name}
        visited_vars = set()

        while worklist:
            current_var = worklist.pop()
            if current_var in visited_vars:
                continue
            visited_vars.add(current_var)

            for node in ast.walk(tree):
                if node.lineno >= target_line:
                    continue

                # Check if this node defines our variable
                if isinstance(node, ast.Assign):
                    for target in node.targets:
                        if isinstance(target, ast.Name) and target.id == current_var:
                            affecting_lines.add(node.lineno)
                            # Add variables used in the RHS to worklist
                            for child in ast.walk(node.value):
                                if isinstance(child, ast.Name) and isinstance(
                                    child.ctx, ast.Load
                                ):
                                    worklist.add(child.id)

        return sorted(affecting_lines)

    def _compute_forward_slice(
        self, tree: ast.Module, var_name: str, target_line: int
    ) -> list[int]:
        """Compute forward slice: lines affected by the target variable."""
        affected_lines = set()

        for node in ast.walk(tree):
            if hasattr(node, "lineno") and node.lineno > target_line:
                # Check if this node uses our variable
                for child in ast.walk(node):
                    if (
                        isinstance(child, ast.Name)
                        and isinstance(child.ctx, ast.Load)
                        and child.id == var_name
                    ):
                        affected_lines.add(node.lineno)
                        break

        return sorted(affected_lines)
