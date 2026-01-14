import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function AccountProfile() {
  const { t } = useTranslation('settings');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <User className="h-6 w-6" />
          Profile
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account information
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-8 text-center">
        <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Profile Settings</h3>
        <p className="text-sm text-muted-foreground">
          User profile management will be available once authentication is enabled.
        </p>
      </div>
    </div>
  );
}
