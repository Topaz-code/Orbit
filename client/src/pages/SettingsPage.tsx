import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bell,
  Database,
  Download,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NOTIFICATION_PREFERENCES, PRIVACY_CHOICES } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useAuth } from '@/hooks/useAuth';
import {
  useChangePassword,
  useDeleteAccount,
  useExportData,
  useNotificationSettings,
  usePrivacySettings,
} from '@/hooks/useSettings';
import { useUpdateProfile } from '@/hooks/useProfile';
import { PasswordField } from '@/components/auth/PasswordField';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Theme, Visibility } from '@/types';

const PRIVACY_FIELDS: Array<{ key: keyof import('@/types').PrivacySettings; label: string; description: string }> = [
  { key: 'postVisibility', label: 'Who can see my posts', description: 'Applies to new posts set to “Public”.' },
  { key: 'whoCanMessage', label: 'Who can message me', description: 'Enforced by the server, not just the UI.' },
  { key: 'phoneVisibility', label: 'Who can see my phone number', description: 'Shown on your profile.' },
  { key: 'onlineStatusVisibility', label: 'Who can see when I am online', description: 'Hides your green dot and last-seen.' },
  { key: 'storyVisibility', label: 'Who can see my stories', description: 'Applies to stories you post from now on.' },
];

export default function SettingsPage() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { logout } = useAuth();

  const { theme, setTheme } = useThemeStore();
  const updateProfile = useUpdateProfile();
  const { privacySettings, update: updatePrivacy } = usePrivacySettings();
  const { notificationSettings, update: updateNotifications } = useNotificationSettings();
  const changePassword = useChangePassword();
  const exportData = useExportData();
  const deleteAccount = useDeleteAccount();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  if (!user) return null;

  const themeOptions: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:px-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Everything here is stored on this server only. Orbit has no analytics and no third parties.
        </p>
      </header>

      <Tabs value={tab ?? 'account'} onValueChange={(value) => navigate(`/settings/${value}`)}>
        <TabsList className="w-full">
          <TabsTrigger value="account" className="flex-1">
            <UserRound className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex-1">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Privacy</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex-1">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Theme</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="flex-1">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-4">
          <Card className="space-y-4 p-5">
            <div>
              <h2 className="font-bold">Your profile</h2>
              <p className="text-sm text-muted-foreground">Change photos from your profile page.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-name">Display name</Label>
              <Input
                id="settings-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={60}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-bio">Bio</Label>
              <Textarea
                id="settings-bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={300}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="settings-email">Email</Label>
                <Input
                  id="settings-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-phone">Phone</Label>
                <Input
                  id="settings-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                loading={updateProfile.isPending}
                onClick={() =>
                  updateProfile.mutate(
                    { displayName: displayName.trim(), bio: bio.trim(), email: email.trim(), phone: phone.trim() },
                    { onSuccess: () => undefined },
                  )
                }
              >
                Save changes
              </Button>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div>
              <h2 className="font-bold">Change password</h2>
              <p className="text-sm text-muted-foreground">
                Passwords are hashed with bcrypt before they ever touch the database.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <PasswordField
                id="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <PasswordField
                id="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                showStrength
              />
            </div>

            <div className="flex justify-end">
              <Button
                loading={changePassword.isPending}
                disabled={!currentPassword || newPassword.length < 8}
                onClick={() =>
                  changePassword.mutate(
                    { currentPassword, newPassword },
                    {
                      onSuccess: () => {
                        setCurrentPassword('');
                        setNewPassword('');
                      },
                    },
                  )
                }
              >
                Update password
              </Button>
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="font-bold">Sessions</h2>
            <p className="text-sm text-muted-foreground">
              Signing out everywhere invalidates every refresh token issued to your account.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void logout(false)}>
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
              <Button variant="outline" onClick={() => setConfirmLogoutAll(true)}>
                <LogOut className="h-4 w-4" />
                Sign out everywhere
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-4">
          <Card className="p-5">
            <div className="mb-4">
              <h2 className="font-bold">Privacy</h2>
              <p className="text-sm text-muted-foreground">
                These rules are applied on the server, so they hold even if someone calls the API directly.
              </p>
            </div>

            <div className="space-y-4">
              {PRIVACY_FIELDS.map((field, index) => (
                <div key={field.key}>
                  {index > 0 ? <Separator className="mb-4" /> : null}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={`privacy-${field.key}`}>{field.label}</Label>
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                    </div>
                    <Select
                      value={privacySettings?.[field.key] ?? 'everyone'}
                      onValueChange={(value) => void updatePrivacy({ [field.key]: value as Visibility })}
                    >
                      <SelectTrigger id={`privacy-${field.key}`} className="w-36 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIVACY_CHOICES.map((choice) => (
                          <SelectItem key={choice.value} value={choice.value}>
                            {choice.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex items-start gap-3 p-5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#22c55e]" />
            <div className="text-sm">
              <p className="font-medium">What Orbit never does</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted-foreground">
                <li>No advertising, and no ad identifiers</li>
                <li>No third-party analytics or tracking pixels</li>
                <li>No selling or sharing of your data — there is nobody to sell it to</li>
                <li>No algorithmic feed reordering your friends&apos; posts</li>
              </ul>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="p-5">
            <div className="mb-4">
              <h2 className="font-bold">Notifications</h2>
              <p className="text-sm text-muted-foreground">Choose what you want to be told about.</p>
            </div>

            <div className="space-y-1">
              {NOTIFICATION_PREFERENCES.map((preference) => (
                <div
                  key={preference.key}
                  className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={`notify-${preference.key}`} className="cursor-pointer">
                      {preference.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{preference.description}</p>
                  </div>
                  <Switch
                    id={`notify-${preference.key}`}
                    checked={notificationSettings?.[preference.key] ?? true}
                    onCheckedChange={(checked) => void updateNotifications({ [preference.key]: checked })}
                  />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card className="p-5">
            <div className="mb-4">
              <h2 className="font-bold">Appearance</h2>
              <p className="text-sm text-muted-foreground">Your choice is saved on this device.</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const active = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setTheme(option.value);
                      updateProfile.mutate({ theme: option.value });
                    }}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors',
                      active ? 'border-[#6366f1] bg-[#6366f1]/5' : 'border-border hover:bg-accent/50',
                    )}
                  >
                    <Icon className={cn('h-5 w-5', active && 'text-[#6366f1]')} />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card className="space-y-3 p-5">
            <div>
              <h2 className="font-bold">Export your data</h2>
              <p className="text-sm text-muted-foreground">
                Download everything Orbit stores about you as a single JSON file — posts, comments,
                messages, stories and group memberships.
              </p>
            </div>
            <Button variant="outline" onClick={() => exportData.mutate()} loading={exportData.isPending}>
              <Download className="h-4 w-4" />
              Download my data
            </Button>
          </Card>

          <Card className="space-y-3 border-destructive/30 p-5">
            <div>
              <h2 className="font-bold text-destructive">Delete your account</h2>
              <p className="text-sm text-muted-foreground">
                This erases your profile, posts, comments, messages and stories from the database
                immediately. There is no recovery and no 30-day grace period.
              </p>
            </div>
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
              Delete account permanently
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmLogoutAll}
        onOpenChange={setConfirmLogoutAll}
        title="Sign out on every device?"
        description="You will need to sign in again everywhere, including here."
        confirmLabel="Sign out everywhere"
        onConfirm={() => {
          setConfirmLogoutAll(false);
          void logout(true);
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete your account?"
        description="Everything you have posted will be removed from this server. This cannot be undone."
        confirmLabel="Yes, delete everything"
        destructive
        loading={deleteAccount.isPending}
        onConfirm={() =>
          deleteAccount.mutate(undefined, {
            onSuccess: () => {
              setConfirmDelete(false);
              void logout(true);
            },
          })
        }
      />
    </div>
  );
}
