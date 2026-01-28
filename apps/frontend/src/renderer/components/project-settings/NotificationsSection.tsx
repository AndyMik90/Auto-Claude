import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { ProjectSettings, NotificationSoundType } from '../../../shared/types';

interface NotificationsSectionProps {
  settings: ProjectSettings;
  onUpdateSettings: (updates: Partial<ProjectSettings>) => void;
}

const SOUND_OPTIONS: { value: NotificationSoundType; label: string }[] = [
  { value: 'chime', label: 'Chime' },
  { value: 'ping', label: 'Ping' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'blip', label: 'Blip' },
  { value: 'soft', label: 'Soft' },
];

export function NotificationsSection({ settings, onUpdateSettings }: NotificationsSectionProps) {
  const handleSoundTypeChange = (value: NotificationSoundType) => {
    onUpdateSettings({
      notifications: {
        ...settings.notifications,
        soundType: value
      }
    });
  };

  const handleTestSound = () => {
    // Play the selected sound for preview
    const soundType = settings.notifications.soundType || 'chime';
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

      const playTone = (freq: number, start: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) => {
        const osc = audioContext.createOscillator();
        const g = audioContext.createGain();
        osc.connect(g);
        g.connect(audioContext.destination);
        osc.frequency.value = freq;
        osc.type = type;
        g.gain.setValueAtTime(volume, audioContext.currentTime + start);
        g.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + start + duration);
        osc.start(audioContext.currentTime + start);
        osc.stop(audioContext.currentTime + start + duration);
      };

      switch (soundType) {
        case 'chime':
          playTone(880, 0, 0.15);
          playTone(660, 0.12, 0.2);
          break;
        case 'ping':
          playTone(1200, 0, 0.1, 'sine', 0.25);
          break;
        case 'pulse':
          playTone(200, 0, 0.08, 'square', 0.2);
          playTone(200, 0.12, 0.08, 'square', 0.2);
          break;
        case 'blip':
          playTone(600, 0, 0.05, 'triangle', 0.3);
          playTone(800, 0.05, 0.05, 'triangle', 0.25);
          break;
        case 'soft':
          {
            const osc = audioContext.createOscillator();
            const g = audioContext.createGain();
            osc.connect(g);
            g.connect(audioContext.destination);
            osc.frequency.value = 440;
            osc.type = 'sine';
            g.gain.setValueAtTime(0.01, audioContext.currentTime);
            g.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 0.1);
            g.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            osc.start();
            osc.stop(audioContext.currentTime + 0.3);
          }
          break;
        default:
          playTone(800, 0, 0.15);
      }

      setTimeout(() => audioContext.close(), 500);
    } catch (err) {
      console.error('[NotificationsSection] Failed to play test sound:', err);
    }
  };

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="font-normal text-foreground">On Task Complete</Label>
          <Switch
            checked={settings.notifications.onTaskComplete}
            onCheckedChange={(checked) =>
              onUpdateSettings({
                notifications: {
                  ...settings.notifications,
                  onTaskComplete: checked
                }
              })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="font-normal text-foreground">On Task Failed</Label>
          <Switch
            checked={settings.notifications.onTaskFailed}
            onCheckedChange={(checked) =>
              onUpdateSettings({
                notifications: {
                  ...settings.notifications,
                  onTaskFailed: checked
                }
              })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="font-normal text-foreground">On Review Needed</Label>
          <Switch
            checked={settings.notifications.onReviewNeeded}
            onCheckedChange={(checked) =>
              onUpdateSettings({
                notifications: {
                  ...settings.notifications,
                  onReviewNeeded: checked
                }
              })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="font-normal text-foreground">Sound</Label>
          <Switch
            checked={settings.notifications.sound}
            onCheckedChange={(checked) =>
              onUpdateSettings({
                notifications: {
                  ...settings.notifications,
                  sound: checked
                }
              })
            }
          />
        </div>
        {settings.notifications.sound && (
          <div className="flex items-center justify-between">
            <Label className="font-normal text-foreground">Sound Type</Label>
            <div className="flex items-center gap-2">
              <Select
                value={settings.notifications.soundType || 'chime'}
                onValueChange={handleSoundTypeChange}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOUND_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={handleTestSound}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Test
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
