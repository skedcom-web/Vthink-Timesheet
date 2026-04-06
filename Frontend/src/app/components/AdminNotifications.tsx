import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Bell, Loader2, Save } from 'lucide-react';
import { notificationsApi } from '../../services/api';
import { toast } from './ui/Toast';

const STATUS_OPTIONS = [
  { value: 'NOT_INITIATED', label: 'Not initiated (no timesheet for week)' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted (pending approval)' },
  { value: 'REJECTED', label: 'Rejected' },
] as const;

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun',
};

type Rule = {
  id: string;
  statusKey: string;
  enabled: boolean;
  weekdaysMonFirst: number[];
  hour: number;
  minute: number;
};

/** Matches AllExceptionsFilter shape: `{ success, error: { message }, meta }` */
function axiosApiMessage(e: unknown): string | undefined {
  const d = (e as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
  return d?.error?.message ?? d?.message;
}

function newRule(): Rule {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}`,
    statusKey: 'NOT_INITIATED',
    enabled: true,
    weekdaysMonFirst: [3, 4],
    hour: 9,
    minute: 0,
  };
}

export default function AdminNotifications({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weeklyEnabled, setWeeklyEnabled] = useState(true);
  const [rules, setRules] = useState<Rule[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationsApi.getSettings();
      setWeeklyEnabled(!!data.weeklyReminderEnabled);
      const raw = data.statusReminderRules;
      const list = Array.isArray(raw) ? (raw as Rule[]) : [];
      setRules(list.length ? list : []);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;
      if (status === 403) {
        toast.error(msg || 'You do not have permission to view notification settings (Super Admin only).');
      } else if (msg) {
        toast.error(`Failed to load notification settings: ${msg}`);
      } else if (e?.message) {
        toast.error(`Failed to load notification settings: ${e.message}`);
      } else {
        toast.error('Failed to load notification settings. Check your connection or try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await notificationsApi.updateSettings({
        weeklyReminderEnabled: weeklyEnabled,
        statusReminderRules: rules,
      });
      toast.success('Notification settings saved');
    } catch (e: any) {
      toast.error(axiosApiMessage(e) || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleWeekday = (ruleIndex: number, d: number) => {
    setRules((prev) =>
      prev.map((r, i) => {
        if (i !== ruleIndex) return r;
        const has = r.weekdaysMonFirst.includes(d);
        return {
          ...r,
          weekdaysMonFirst: has
            ? r.weekdaysMonFirst.filter((x) => x !== d)
            : [...r.weekdaysMonFirst, d].sort((a, b) => a - b),
        };
      }),
    );
  };

  return (
    <div className="p-6 max-w-3xl text-[var(--text-1)]">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[var(--primary)] hover:opacity-85 font-medium mb-6 transition-opacity"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Overview
      </button>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary-tint flex items-center justify-center">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold font-bold color-text-1">Email notifications</h1>
          <p className="text-[var(--text-2)] text-sm">Super Admin only — schedules apply to all users except Super Admin (IST).</p>
        </div>
      </div>

      <p className="text-sm text-[var(--text-2)] mb-6 border border-[var(--border)] rounded-lg p-4 bg-[var(--card-bg)]">
        Weekly reminders run <strong>Monday 00:00:01 IST</strong>. Status reminders run on the hours you set on the selected weekdays.
        Company Admins and other roles <strong>receive</strong> these emails; only a Super Admin can change this page.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-3)] py-12">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={weeklyEnabled}
                onChange={(e) => setWeeklyEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border)]"
              />
              <span className="font-medium">Weekly timesheet reminder (Monday 00:00:01 IST)</span>
            </label>
            <p className="text-xs text-[var(--text-3)] mt-2 ml-7">Email all eligible users to start logging the new week.</p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Status-based reminders</h2>
              <button
                type="button"
                onClick={() => setRules((r) => [...r, newRule()])}
                className="text-sm text-[var(--primary)] font-medium hover:opacity-90"
              >
                + Add rule
              </button>
            </div>

            {rules.length === 0 && (
              <p className="text-sm text-[var(--text-3)]">No rules. Add a rule to nudge users mid-week (e.g. Not initiated on Wed/Thu).</p>
            )}

            {rules.map((rule, idx) => (
              <div
                key={rule.id}
                className="border border-[var(--border)] rounded-lg p-4 space-y-3"
                style={{ background: 'color-mix(in srgb, var(--card-bg) 92%, var(--page-bg))' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) =>
                        setRules((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, enabled: e.target.checked } : r)),
                        )
                      }
                    />
                    <span className="text-sm font-medium">Enabled</span>
                  </label>
                  <button
                    type="button"
                    className="text-xs text-[var(--danger)] hover:underline"
                    onClick={() => setRules((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Timesheet status</label>
                  <select
                    value={rule.statusKey}
                    onChange={(e) =>
                      setRules((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, statusKey: e.target.value } : r)),
                      )
                    }
                    className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--card-bg)] text-[var(--text-1)]"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="block text-xs font-medium text-[var(--text-2)] mb-2">Send on (IST weekdays)</span>
                  <div className="flex flex-wrap gap-2">
                    {([1, 2, 3, 4, 5, 6, 7] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleWeekday(idx, d)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          rule.weekdaysMonFirst.includes(d)
                            ? 'border-[var(--primary)] bg-[var(--primary-tint)] text-[var(--primary)]'
                            : 'border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--nav-hover-bg)]'
                        }`}
                      >
                        {WEEKDAY_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Hour (0–23)</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={rule.hour}
                      onChange={(e) =>
                        setRules((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, hour: Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0)) } : r,
                          ),
                        )
                      }
                      className="w-24 border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm bg-[var(--card-bg)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Minute (0–59)</label>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={rule.minute}
                      onChange={(e) =>
                        setRules((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, minute: Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)) } : r,
                          ),
                        )
                      }
                      className="w-24 border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm bg-[var(--card-bg)]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--vthink-purple))' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save settings
          </button>
        </div>
      )}
    </div>
  );
}
