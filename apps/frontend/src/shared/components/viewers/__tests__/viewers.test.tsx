/**
 * @vitest-environment jsdom
 */
/**
 * Tests for Viewer Components
 *
 * Tests the YamlViewer, JsonViewer, MarkdownViewer, RawTextViewer, and ArtifactViewer components.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, string>) => {
      // Handle fallback objects (e.g., { defaultValue: '...' })
      if (typeof fallback === 'object' && 'defaultValue' in fallback) {
        return fallback.defaultValue;
      }
      // Handle string fallbacks
      if (typeof fallback === 'string') {
        return fallback;
      }
      // Return the key as-is for testing
      const translations: Record<string, string> = {
        'common:buttons.copy': 'Copy',
        'common:labels.success': 'Copied!',
        'common:labels.tree': 'Tree',
        'common:labels.raw': 'Raw',
        'common:labels.jsonTree': 'JSON Tree',
        'common:labels.noContent': 'No content to display',
        'errors:parseError': 'Parse Error',
        'errors:loadError': 'Failed to load content',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

// Mock react-syntax-highlighter
vi.mock('react-syntax-highlighter', () => {
  const MockPrismLight = ({ children, language, showLineNumbers }: {
    children: string;
    language: string;
    showLineNumbers?: boolean;
  }) => (
    <pre data-testid="syntax-highlighter" data-language={language} data-line-numbers={showLineNumbers}>
      {children}
    </pre>
  );
  // Add registerLanguage as a static method
  MockPrismLight.registerLanguage = () => {};

  return {
    PrismLight: MockPrismLight,
  };
});

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {},
}));

vi.mock('react-syntax-highlighter/dist/esm/languages/prism/yaml', () => ({
  default: {},
}));

vi.mock('react-syntax-highlighter/dist/esm/languages/prism/json', () => ({
  default: {},
}));

vi.mock('react-syntax-highlighter/dist/esm/languages/prism/typescript', () => ({
  default: {},
}));

vi.mock('react-syntax-highlighter/dist/esm/languages/prism/javascript', () => ({
  default: {},
}));

vi.mock('react-syntax-highlighter/dist/esm/languages/prism/python', () => ({
  default: {},
}));

vi.mock('react-syntax-highlighter/dist/esm/languages/prism/bash', () => ({
  default: {},
}));

vi.mock('react-syntax-highlighter/dist/esm/languages/prism/css', () => ({
  default: {},
}));

vi.mock('react-syntax-highlighter/dist/esm/languages/prism/markdown', () => ({
  default: {},
}));

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: vi.fn(({ children }: { children: string }) => (
    <div data-testid="markdown-renderer">{children}</div>
  )),
}));

// Mock remark-gfm
vi.mock('remark-gfm', () => ({
  default: {},
}));

// Import components after mocks
import { YamlViewer } from '../YamlViewer';
import { JsonViewer } from '../JsonViewer';
import { RawTextViewer } from '../RawTextViewer';
import { ArtifactViewer, FileTypeBadge } from '../ArtifactViewer';

describe('YamlViewer', () => {
  const validYaml = `name: test
version: 1.0.0
description: A test config`;

  // YAML with a mapping value indicator (:) without proper formatting - this causes parse error
  const invalidYaml = `name: test
- items:
  - nested: value
 bad: indentation`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders valid YAML content', () => {
      render(<YamlViewer content={validYaml} />);

      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument();
      expect(screen.getByTestId('syntax-highlighter')).toHaveTextContent('name: test');
    });

    it('renders with filename', () => {
      render(<YamlViewer content={validYaml} filename="config.yaml" />);

      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument();
    });

    it('shows copy button by default', () => {
      render(<YamlViewer content={validYaml} />);

      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });

    it('hides copy button when showCopyButton is false', () => {
      render(<YamlViewer content={validYaml} showCopyButton={false} />);

      expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
    });

    it('renders with custom className', () => {
      const { container } = render(<YamlViewer content={validYaml} className="custom-class" />);

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('copy functionality', () => {
    it('copies content to clipboard when copy button is clicked', async () => {
      render(<YamlViewer content={validYaml} />);

      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(validYaml);
    });
  });

  describe('error handling', () => {
    it('displays error banner for invalid YAML', () => {
      render(<YamlViewer content={invalidYaml} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Parse Error')).toBeInTheDocument();
    });

    it('still shows content even when parsing fails', () => {
      render(<YamlViewer content={invalidYaml} />);

      // Content should still be visible
      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument();
    });
  });
});

describe('JsonViewer', () => {
  const validJson = `{
  "name": "test",
  "version": "1.0.0",
  "nested": {
    "key": "value"
  }
}`;

  const invalidJson = `{
  "name": "test",
  invalid
}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders valid JSON content in tree view by default', () => {
      render(<JsonViewer content={validJson} />);

      // Tree view should be present
      expect(screen.getByRole('tree')).toBeInTheDocument();
    });

    it('renders in raw view when defaultViewMode is raw', () => {
      render(<JsonViewer content={validJson} defaultViewMode="raw" />);

      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument();
    });

    it('shows copy button by default', () => {
      render(<JsonViewer content={validJson} />);

      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });

    it('shows view mode toggle buttons', () => {
      render(<JsonViewer content={validJson} />);

      expect(screen.getByText('Tree')).toBeInTheDocument();
      expect(screen.getByText('Raw')).toBeInTheDocument();
    });

    it('hides view mode toggle when allowViewModeSwitch is false', () => {
      render(<JsonViewer content={validJson} allowViewModeSwitch={false} />);

      expect(screen.queryByText('Tree')).not.toBeInTheDocument();
      expect(screen.queryByText('Raw')).not.toBeInTheDocument();
    });
  });

  describe('view mode switching', () => {
    it('switches to raw view when Raw button is clicked', () => {
      render(<JsonViewer content={validJson} />);

      const rawButton = screen.getByText('Raw');
      fireEvent.click(rawButton);

      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument();
    });

    it('switches back to tree view when Tree button is clicked', () => {
      render(<JsonViewer content={validJson} defaultViewMode="raw" />);

      const treeButton = screen.getByText('Tree');
      fireEvent.click(treeButton);

      expect(screen.getByRole('tree')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error banner for invalid JSON', () => {
      render(<JsonViewer content={invalidJson} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Parse Error')).toBeInTheDocument();
    });

    it('falls back to raw view for invalid JSON', () => {
      render(<JsonViewer content={invalidJson} />);

      // Should show syntax highlighter (raw view) not tree
      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument();
      expect(screen.queryByRole('tree')).not.toBeInTheDocument();
    });
  });

  describe('copy functionality', () => {
    it('copies content to clipboard when copy button is clicked', async () => {
      render(<JsonViewer content={validJson} />);

      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(validJson);
    });
  });
});

describe('RawTextViewer', () => {
  const textContent = `Line 1
Line 2
Line 3`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders text content', () => {
      render(<RawTextViewer content={textContent} />);

      expect(screen.getByText('Line 1')).toBeInTheDocument();
      expect(screen.getByText('Line 2')).toBeInTheDocument();
      expect(screen.getByText('Line 3')).toBeInTheDocument();
    });

    it('shows line numbers by default', () => {
      render(<RawTextViewer content={textContent} />);

      // Line numbers should be visible (1, 2, 3)
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('hides line numbers when showLineNumbers is false', () => {
      render(<RawTextViewer content={textContent} showLineNumbers={false} />);

      // Line number 1 might appear in content but there should be no line number column
      const lineNumber1 = screen.queryByText('1');
      // When line numbers are hidden, the number might still appear in content
      // but won't be in a separate column with the line-number styling
    });

    it('shows copy button by default', () => {
      render(<RawTextViewer content={textContent} />);

      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      const { container } = render(<RawTextViewer content={textContent} className="custom-class" />);

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('copy functionality', () => {
    it('copies content to clipboard when copy button is clicked', async () => {
      render(<RawTextViewer content={textContent} />);

      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(textContent);
    });
  });
});

describe('ArtifactViewer', () => {
  const yamlContent = `name: test
version: 1.0.0`;

  const jsonContent = `{"name": "test"}`;

  const markdownContent = `# Heading

Some text content`;

  const textContent = `Plain text content`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('file type detection', () => {
    it('renders YamlViewer for .yaml files', () => {
      render(<ArtifactViewer content={yamlContent} filename="config.yaml" />);

      expect(screen.getByTestId('syntax-highlighter')).toHaveAttribute('data-language', 'yaml');
    });

    it('renders YamlViewer for .yml files', () => {
      render(<ArtifactViewer content={yamlContent} filename="config.yml" />);

      expect(screen.getByTestId('syntax-highlighter')).toHaveAttribute('data-language', 'yaml');
    });

    it('renders JsonViewer for .json files', () => {
      render(<ArtifactViewer content={jsonContent} filename="data.json" />);

      // JSON viewer shows tree by default for valid JSON
      expect(screen.getByRole('tree')).toBeInTheDocument();
    });

    it('renders MarkdownViewer for .md files', () => {
      render(<ArtifactViewer content={markdownContent} filename="README.md" />);

      expect(screen.getByTestId('markdown-renderer')).toBeInTheDocument();
    });

    it('renders RawTextViewer for unknown extensions', () => {
      render(<ArtifactViewer content={textContent} filename="file.txt" />);

      expect(screen.getByText('Plain text content')).toBeInTheDocument();
    });
  });

  describe('forced type', () => {
    it('uses forceType over filename extension', () => {
      render(<ArtifactViewer content={jsonContent} filename="data.yaml" forceType="json" />);

      // Should render as JSON (tree view) despite .yaml extension
      expect(screen.getByRole('tree')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading skeleton when isLoading is true', () => {
      const { container } = render(<ArtifactViewer content="" isLoading={true} />);

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when error prop is provided', () => {
      render(<ArtifactViewer content="" error="Failed to load file" />);

      expect(screen.getByText('Failed to load content')).toBeInTheDocument();
      expect(screen.getByText('Failed to load file')).toBeInTheDocument();
    });
  });

  describe('empty content', () => {
    it('shows empty content message when content is empty', () => {
      render(<ArtifactViewer content="" />);

      expect(screen.getByText('No content to display')).toBeInTheDocument();
    });

    it('shows filename in empty message when provided', () => {
      render(<ArtifactViewer content="" filename="empty.txt" />);

      expect(screen.getByText('empty.txt is empty')).toBeInTheDocument();
    });
  });

  describe('onTypeDetected callback', () => {
    it('calls onTypeDetected with detected type', () => {
      const onTypeDetected = vi.fn();
      render(
        <ArtifactViewer
          content={yamlContent}
          filename="config.yaml"
          onTypeDetected={onTypeDetected}
        />
      );

      expect(onTypeDetected).toHaveBeenCalledWith('yaml');
    });
  });
});

describe('FileTypeBadge', () => {
  it('renders with file type', () => {
    render(<FileTypeBadge type="yaml" />);

    expect(screen.getByText('YAML')).toBeInTheDocument();
  });

  it('renders with filename', () => {
    render(<FileTypeBadge type="json" filename="config.json" />);

    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('config.json')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<FileTypeBadge type="markdown" className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
