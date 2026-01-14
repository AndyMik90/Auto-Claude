import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function AccountSecurity() {
  const { t } = useTranslation('settings');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Security
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Password and authentication settings
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-8 text-center">
        <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Security Settings</h3>
        <p className="text-sm text-muted-foreground">
          Password management and security settings will be available once authentication is enabled.
        </p>
      </div>
    </div>
  );
}
