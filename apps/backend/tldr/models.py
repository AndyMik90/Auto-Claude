"""
TLDR Data Models
================

Data structures for multi-layer code analysis summaries.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class AnalysisLayer(Enum):
    """Available analysis layers with approximate token costs."""

    L1_AST = 1  # ~500 tokens - Functions, classes, signatures
    L2_CALL_GRAPH = 2  # +440 tokens - Cross-file dependencies
    L3_CFG = 3  # +110 tokens - Control flow
    L4_DFG = 4  # +130 tokens - Data flow
    L5_PDG = 5  # +150 tokens - Program dependency graph


@dataclass
class ImportInfo:
    """Import statement information."""

    module: str
    names: list[str] = field(default_factory=list)  # Specific imports (from X import a, b)
    alias: str | None = None  # import X as Y
    is_relative: bool = False
    level: int = 0  # Number of dots for relative imports

    def to_dict(self) -> dict[str, Any]:
        return {
            "module": self.module,
            "names": self.names,
            "alias": self.alias,
            "is_relative": self.is_relative,
            "level": self.level,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ImportInfo:
        return cls(
            module=data["module"],
            names=data.get("names", []),
            alias=data.get("alias"),
            is_relative=data.get("is_relative", False),
            level=data.get("level", 0),
        )


@dataclass
class ParameterInfo:
    """Function parameter information."""

    name: str
    type_hint: str | None = None
    default: str | None = None
    is_variadic: bool = False  # *args
    is_keyword: bool = False  # **kwargs

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "type_hint": self.type_hint,
            "default": self.default,
            "is_variadic": self.is_variadic,
            "is_keyword": self.is_keyword,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ParameterInfo:
        return cls(
            name=data["name"],
            type_hint=data.get("type_hint"),
            default=data.get("default"),
            is_variadic=data.get("is_variadic", False),
            is_keyword=data.get("is_keyword", False),
        )


@dataclass
class FunctionSignature:
    """Function or method signature."""

    name: str
    parameters: list[ParameterInfo] = field(default_factory=list)
    return_type: str | None = None
    decorators: list[str] = field(default_factory=list)
    docstring: str | None = None
    is_async: bool = False
    is_generator: bool = False
    is_method: bool = False
    is_static: bool = False
    is_classmethod: bool = False
    is_property: bool = False
    line_start: int = 0
    line_end: int = 0
    complexity: int = 1  # Cyclomatic complexity

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "parameters": [p.to_dict() for p in self.parameters],
            "return_type": self.return_type,
            "decorators": self.decorators,
            "docstring": self.docstring,
            "is_async": self.is_async,
            "is_generator": self.is_generator,
            "is_method": self.is_method,
            "is_static": self.is_static,
            "is_classmethod": self.is_classmethod,
            "is_property": self.is_property,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "complexity": self.complexity,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> FunctionSignature:
        return cls(
            name=data["name"],
            parameters=[ParameterInfo.from_dict(p) for p in data.get("parameters", [])],
            return_type=data.get("return_type"),
            decorators=data.get("decorators", []),
            docstring=data.get("docstring"),
            is_async=data.get("is_async", False),
            is_generator=data.get("is_generator", False),
            is_method=data.get("is_method", False),
            is_static=data.get("is_static", False),
            is_classmethod=data.get("is_classmethod", False),
            is_property=data.get("is_property", False),
            line_start=data.get("line_start", 0),
            line_end=data.get("line_end", 0),
            complexity=data.get("complexity", 1),
        )

    def signature_str(self) -> str:
        """Generate compact signature string."""
        params = ", ".join(
            f"{p.name}: {p.type_hint}" if p.type_hint else p.name
            for p in self.parameters
        )
        ret = f" -> {self.return_type}" if self.return_type else ""
        prefix = "async " if self.is_async else ""
        return f"{prefix}def {self.name}({params}){ret}"


@dataclass
class ClassSignature:
    """Class definition signature."""

    name: str
    bases: list[str] = field(default_factory=list)
    decorators: list[str] = field(default_factory=list)
    docstring: str | None = None
    methods: list[FunctionSignature] = field(default_factory=list)
    attributes: list[tuple[str, str | None]] = field(default_factory=list)  # (name, type_hint)
    is_dataclass: bool = False
    is_abstract: bool = False
    line_start: int = 0
    line_end: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "bases": self.bases,
            "decorators": self.decorators,
            "docstring": self.docstring,
            "methods": [m.to_dict() for m in self.methods],
            "attributes": self.attributes,
            "is_dataclass": self.is_dataclass,
            "is_abstract": self.is_abstract,
            "line_start": self.line_start,
            "line_end": self.line_end,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ClassSignature:
        return cls(
            name=data["name"],
            bases=data.get("bases", []),
            decorators=data.get("decorators", []),
            docstring=data.get("docstring"),
            methods=[FunctionSignature.from_dict(m) for m in data.get("methods", [])],
            attributes=data.get("attributes", []),
            is_dataclass=data.get("is_dataclass", False),
            is_abstract=data.get("is_abstract", False),
            line_start=data.get("line_start", 0),
            line_end=data.get("line_end", 0),
        )


@dataclass
class CallGraphEdge:
    """Edge in the call graph (L2)."""

    caller: str  # Fully qualified name
    callee: str  # Fully qualified name
    call_site_line: int = 0
    is_external: bool = False  # Calls to external modules

    def to_dict(self) -> dict[str, Any]:
        return {
            "caller": self.caller,
            "callee": self.callee,
            "call_site_line": self.call_site_line,
            "is_external": self.is_external,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CallGraphEdge:
        return cls(
            caller=data["caller"],
            callee=data["callee"],
            call_site_line=data.get("call_site_line", 0),
            is_external=data.get("is_external", False),
        )


@dataclass
class ControlFlowNode:
    """Node in the control flow graph (L3)."""

    id: str
    node_type: str  # if, while, for, try, with, match, return, raise, etc.
    line: int
    condition: str | None = None  # For conditionals
    branches: list[str] = field(default_factory=list)  # IDs of successor nodes

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "node_type": self.node_type,
            "line": self.line,
            "condition": self.condition,
            "branches": self.branches,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ControlFlowNode:
        return cls(
            id=data["id"],
            node_type=data["node_type"],
            line=data.get("line", 0),
            condition=data.get("condition"),
            branches=data.get("branches", []),
        )


@dataclass
class DataFlowEdge:
    """Edge in the data flow graph (L4)."""

    variable: str
    definition_line: int
    use_line: int
    flow_type: str = "def-use"  # def-use, use-def, def-def

    def to_dict(self) -> dict[str, Any]:
        return {
            "variable": self.variable,
            "definition_line": self.definition_line,
            "use_line": self.use_line,
            "flow_type": self.flow_type,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DataFlowEdge:
        return cls(
            variable=data["variable"],
            definition_line=data.get("definition_line", 0),
            use_line=data.get("use_line", 0),
            flow_type=data.get("flow_type", "def-use"),
        )


@dataclass
class DependencySlice:
    """Program slice for a specific variable/statement (L5)."""

    target: str  # Variable or statement being sliced
    target_line: int
    backward_slice: list[int] = field(default_factory=list)  # Lines that affect target
    forward_slice: list[int] = field(default_factory=list)  # Lines affected by target
    relevant_functions: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "target": self.target,
            "target_line": self.target_line,
            "backward_slice": self.backward_slice,
            "forward_slice": self.forward_slice,
            "relevant_functions": self.relevant_functions,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DependencySlice:
        return cls(
            target=data["target"],
            target_line=data.get("target_line", 0),
            backward_slice=data.get("backward_slice", []),
            forward_slice=data.get("forward_slice", []),
            relevant_functions=data.get("relevant_functions", []),
        )


@dataclass
class TLDRSummary:
    """
    Complete TLDR summary for a file.

    Contains multi-layer analysis results with configurable depth.
    """

    file_path: str
    language: str
    file_hash: str  # For cache invalidation
    total_lines: int
    original_tokens: int  # Estimated tokens in original file
    summary_tokens: int  # Estimated tokens in this summary

    # L1: AST Layer
    imports: list[ImportInfo] = field(default_factory=list)
    functions: list[FunctionSignature] = field(default_factory=list)
    classes: list[ClassSignature] = field(default_factory=list)
    module_docstring: str | None = None
    global_variables: list[tuple[str, str | None]] = field(default_factory=list)

    # L2: Call Graph Layer
    call_graph: list[CallGraphEdge] = field(default_factory=list)
    external_calls: list[str] = field(default_factory=list)  # External modules called

    # L3: Control Flow Layer
    control_flow: dict[str, list[ControlFlowNode]] = field(default_factory=dict)  # func_name -> nodes

    # L4: Data Flow Layer
    data_flow: dict[str, list[DataFlowEdge]] = field(default_factory=dict)  # func_name -> edges

    # L5: Program Dependency Layer
    slices: list[DependencySlice] = field(default_factory=list)

    # Metadata
    layers_included: list[int] = field(default_factory=list)
    analysis_time_ms: float = 0.0
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "file_path": self.file_path,
            "language": self.language,
            "file_hash": self.file_hash,
            "total_lines": self.total_lines,
            "original_tokens": self.original_tokens,
            "summary_tokens": self.summary_tokens,
            "imports": [i.to_dict() for i in self.imports],
            "functions": [f.to_dict() for f in self.functions],
            "classes": [c.to_dict() for c in self.classes],
            "module_docstring": self.module_docstring,
            "global_variables": self.global_variables,
            "call_graph": [e.to_dict() for e in self.call_graph],
            "external_calls": self.external_calls,
            "control_flow": {
                k: [n.to_dict() for n in v] for k, v in self.control_flow.items()
            },
            "data_flow": {
                k: [e.to_dict() for e in v] for k, v in self.data_flow.items()
            },
            "slices": [s.to_dict() for s in self.slices],
            "layers_included": self.layers_included,
            "analysis_time_ms": self.analysis_time_ms,
            "errors": self.errors,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TLDRSummary:
        return cls(
            file_path=data["file_path"],
            language=data["language"],
            file_hash=data["file_hash"],
            total_lines=data.get("total_lines", 0),
            original_tokens=data.get("original_tokens", 0),
            summary_tokens=data.get("summary_tokens", 0),
            imports=[ImportInfo.from_dict(i) for i in data.get("imports", [])],
            functions=[FunctionSignature.from_dict(f) for f in data.get("functions", [])],
            classes=[ClassSignature.from_dict(c) for c in data.get("classes", [])],
            module_docstring=data.get("module_docstring"),
            global_variables=data.get("global_variables", []),
            call_graph=[CallGraphEdge.from_dict(e) for e in data.get("call_graph", [])],
            external_calls=data.get("external_calls", []),
            control_flow={
                k: [ControlFlowNode.from_dict(n) for n in v]
                for k, v in data.get("control_flow", {}).items()
            },
            data_flow={
                k: [DataFlowEdge.from_dict(e) for e in v]
                for k, v in data.get("data_flow", {}).items()
            },
            slices=[DependencySlice.from_dict(s) for s in data.get("slices", [])],
            layers_included=data.get("layers_included", []),
            analysis_time_ms=data.get("analysis_time_ms", 0.0),
            errors=data.get("errors", []),
        )

    def token_savings_percent(self) -> float:
        """Calculate percentage of tokens saved."""
        if self.original_tokens == 0:
            return 0.0
        return (1 - self.summary_tokens / self.original_tokens) * 100

    def to_compact(self, include_docstrings: bool = False) -> str:
        """
        Generate compact text representation for LLM consumption.

        This is the token-efficient format that replaces full file reads.
        """
        lines = [f"# TLDR: {self.file_path}"]
        lines.append(f"# Language: {self.language} | Lines: {self.total_lines}")
        lines.append(f"# Tokens: {self.summary_tokens} (saved {self.token_savings_percent():.0f}%)")
        lines.append("")

        # Imports
        if self.imports:
            lines.append("## Imports")
            for imp in self.imports:
                if imp.names:
                    lines.append(f"from {imp.module} import {', '.join(imp.names)}")
                elif imp.alias:
                    lines.append(f"import {imp.module} as {imp.alias}")
                else:
                    lines.append(f"import {imp.module}")
            lines.append("")

        # Classes
        for cls in self.classes:
            bases = f"({', '.join(cls.bases)})" if cls.bases else ""
            decorators = "\n".join(f"@{d}" for d in cls.decorators)
            if decorators:
                lines.append(decorators)
            lines.append(f"class {cls.name}{bases}:")
            if include_docstrings and cls.docstring:
                lines.append(f'    """{cls.docstring[:100]}..."""')
            for attr_name, attr_type in cls.attributes:
                type_str = f": {attr_type}" if attr_type else ""
                lines.append(f"    {attr_name}{type_str}")
            for method in cls.methods:
                lines.append(f"    {method.signature_str()}")
            lines.append("")

        # Standalone functions
        standalone = [f for f in self.functions if not f.is_method]
        if standalone:
            lines.append("## Functions")
            for func in standalone:
                decorators = " ".join(f"@{d}" for d in func.decorators)
                if decorators:
                    lines.append(decorators)
                lines.append(func.signature_str())
                if include_docstrings and func.docstring:
                    lines.append(f'    """{func.docstring[:80]}..."""')
            lines.append("")

        # Call graph (L2)
        if self.call_graph and 2 in self.layers_included:
            lines.append("## Call Graph")
            for edge in self.call_graph[:20]:  # Limit for token efficiency
                lines.append(f"  {edge.caller} -> {edge.callee}")
            if len(self.call_graph) > 20:
                lines.append(f"  ... and {len(self.call_graph) - 20} more edges")
            lines.append("")

        # Control flow (L3)
        if self.control_flow and 3 in self.layers_included:
            lines.append("## Control Flow")
            for func_name, nodes in list(self.control_flow.items())[:5]:
                lines.append(f"  {func_name}: {len(nodes)} control nodes")
            lines.append("")

        # External dependencies
        if self.external_calls:
            lines.append("## External Dependencies")
            lines.append(f"  {', '.join(self.external_calls[:10])}")
            lines.append("")

        return "\n".join(lines)
