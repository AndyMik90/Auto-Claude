import { RotateCcw, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { SettingsSection } from './SettingsSection';
import { SliderControl } from './SliderControl';
import { useSettingsStore } from '../../stores/settings-store';
import { Label } from '../ui/label';
import {
  TERMINAL_FONT_SIZE_MIN,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_STEP,
  TERMINAL_LINE_HEIGHT_MIN,
  TERMINAL_LINE_HEIGHT_MAX,
  TERMINAL_LINE_HEIGHT_STEP,
  TERMINAL_LETTER_SPACING_MIN,
  TERMINAL_LETTER_SPACING_MAX,
  TERMINAL_LETTER_SPACING_STEP,
  DEFAULT_TERMINAL_FONT_SETTINGS,
  TERMINAL_FONT_FAMILY_OPTIONS
} from '../../../shared/constants/config';
import type { AppSettings, TerminalFontFamily } from '../../../shared/types';

interface TerminalSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * Terminal settings section for font customization
 * Provides font family selector, size slider, line height, and letter spacing controls
 * Changes apply immediately to all open terminals
 */
export function TerminalSettings({ settings, onSettingsChange }: TerminalSettingsProps) {
  const { t } = useTranslation('settings');
  const updateStoreSettings = useSettingsStore((state) => state.updateSettings);

  const currentFontSettings = settings.terminalFont ?? DEFAULT_TERMINAL_FONT_SETTINGS;

  // fontFamily is now a TerminalFontFamily key (e.g., 'system', 'jetbrainsMono')
  const selectedFontFamily = currentFontSettings.fontFamily;

  // Update font settings immediately (applies to all open terminals)
  const updateFontSettings = (updates: Partial<typeof DEFAULT_TERMINAL_FONT_SETTINGS> & { fontFamily?: TerminalFontFamily }) => {
    const newFontSettings = { ...currentFontSettings, ...updates };
    onSettingsChange({ ...settings, terminalFont: newFontSettings });
    updateStoreSettings({ terminalFont: newFontSettings });
  };

  const handleFontFamilyChange = (fontFamily: TerminalFontFamily) => {
    updateFontSettings({ fontFamily });
  };

  const handleFontSizeChange = (fontSize: number) => {
    const clampedSize = Math.max(TERMINAL_FONT_SIZE_MIN, Math.min(TERMINAL_FONT_SIZE_MAX, fontSize));
    updateFontSettings({ fontSize: clampedSize });
  };

  const handleLineHeightChange = (lineHeight: number) => {
    const clampedHeight = Math.max(TERMINAL_LINE_HEIGHT_MIN, Math.min(TERMINAL_LINE_HEIGHT_MAX, lineHeight));
    updateFontSettings({ lineHeight: clampedHeight });
  };

  const handleLetterSpacingChange = (letterSpacing: number) => {
    const clampedSpacing = Math.max(TERMINAL_LETTER_SPACING_MIN, Math.min(TERMINAL_LETTER_SPACING_MAX, letterSpacing));
    updateFontSettings({ letterSpacing: clampedSpacing });
  };

  const handleReset = () => {
    updateFontSettings(DEFAULT_TERMINAL_FONT_SETTINGS);
  };

  // Epsilon-based comparison for floating-point values
  // Slider interactions can introduce tiny precision errors
  const approxEqual = (a: number, b: number, eps = 0.0001): boolean => Math.abs(a - b) < eps;

  const isDefault =
    currentFontSettings.fontSize === DEFAULT_TERMINAL_FONT_SETTINGS.fontSize &&
    approxEqual(currentFontSettings.lineHeight, DEFAULT_TERMINAL_FONT_SETTINGS.lineHeight) &&
    approxEqual(currentFontSettings.letterSpacing, DEFAULT_TERMINAL_FONT_SETTINGS.letterSpacing) &&
    selectedFontFamily === DEFAULT_TERMINAL_FONT_SETTINGS.fontFamily;

  return (
    <SettingsSection
      title={t('sections.terminal.title')}
      description={t('sections.terminal.description')}
    >
      <div className="space-y-6">
        {/* Font Family Selector */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-foreground">{t('terminal.fontFamily')}</Label>
          <p className="text-sm text-muted-foreground">
            {t('terminal.fontFamilyDescription')}
          </p>
          <div className="grid grid-cols-2 gap-2 max-w-lg pt-1">
            {Object.entries(TERMINAL_FONT_FAMILY_OPTIONS).map(([key, { labelKey, fontStack }]) => {
              const isSelected = selectedFontFamily === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => handleFontFamilyChange(key as TerminalFontFamily)}
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-accent/50'
                  )}
                  style={{ fontFamily: fontStack }}
                >
                  <Terminal className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">{t(labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Size Slider */}
        <SliderControl
          labelKey="terminal.fontSize"
          descriptionKey="terminal.fontSizeDescription"
          value={currentFontSettings.fontSize}
          displayValue={`${currentFontSettings.fontSize}px`}
          min={TERMINAL_FONT_SIZE_MIN}
          max={TERMINAL_FONT_SIZE_MAX}
          step={TERMINAL_FONT_SIZE_STEP}
          defaultValue={DEFAULT_TERMINAL_FONT_SETTINGS.fontSize}
          ariaLabel={t('terminal.fontSize')}
          onChange={handleFontSizeChange}
        />

        {/* Line Height Slider */}
        <SliderControl
          labelKey="terminal.lineHeight"
          descriptionKey="terminal.lineHeightDescription"
          value={currentFontSettings.lineHeight}
          displayValue={currentFontSettings.lineHeight.toFixed(2)}
          min={TERMINAL_LINE_HEIGHT_MIN}
          max={TERMINAL_LINE_HEIGHT_MAX}
          step={TERMINAL_LINE_HEIGHT_STEP}
          defaultValue={DEFAULT_TERMINAL_FONT_SETTINGS.lineHeight}
          ariaLabel={t('terminal.lineHeight')}
          onChange={handleLineHeightChange}
          approxEqual={approxEqual}
        />

        {/* Letter Spacing Slider */}
        <SliderControl
          labelKey="terminal.letterSpacing"
          descriptionKey="terminal.letterSpacingDescription"
          value={currentFontSettings.letterSpacing}
          displayValue={`${currentFontSettings.letterSpacing > 0 ? '+' : ''}${currentFontSettings.letterSpacing.toFixed(1)}`}
          min={TERMINAL_LETTER_SPACING_MIN}
          max={TERMINAL_LETTER_SPACING_MAX}
          step={TERMINAL_LETTER_SPACING_STEP}
          defaultValue={DEFAULT_TERMINAL_FONT_SETTINGS.letterSpacing}
          ariaLabel={t('terminal.letterSpacing')}
          onChange={handleLetterSpacingChange}
          approxEqual={approxEqual}
        />

        {/* Reset All Button */}
        {!isDefault && (
          <div className="pt-4 border-t border-border">
            <button
              type="button"
              onClick={handleReset}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md transition-colors',
                'hover:bg-accent text-muted-foreground hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              <RotateCcw className="h-4 w-4" />
              <span className="text-sm font-medium">{t('terminal.resetAll')}</span>
            </button>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
