'use client'

import { useState } from 'react'
import { Plus, Zap, Play, Trash2, Edit, Clock, CheckCircle, XCircle } from 'lucide-react'
import { useAutomations, useCreateAutomation, useUpdateAutomation, useDeleteAutomation, useToggleAutomation, useTestAutomation } from '@/hooks/useAutomations'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeleton } from '@/components/ui/LoadingSkeleton'
import { useAppStore } from '@/lib/store'
import { formatRelativeTime, prettyJson } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Automation } from '@/types'

const automationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable(),
  trigger_json: z.string().min(1, 'Trigger is required'),
  conditions_json: z.string(),
  actions_json: z.string().min(1, 'At least one action is required'),
})

type AutomationFormData = z.infer<typeof automationSchema>

function AutomationFormModal({
  open,
  onClose,
  defaultValues,
}: {
  open: boolean
  onClose: () => void
  defaultValues?: Automation | null
}) {
  const createAutomation = useCreateAutomation()
  const updateAutomation = useUpdateAutomation(defaultValues?.id ?? 0)
  const { addToast } = useAppStore()

  const { register, handleSubmit, formState: { errors } } = useForm<AutomationFormData>({
    resolver: zodResolver(automationSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      trigger_json: defaultValues?.trigger ? prettyJson(defaultValues.trigger) : '{\n  "type": "state_change",\n  "device_id": 1,\n  "state_key": "POWER",\n  "state_value": "ON"\n}',
      conditions_json: defaultValues?.conditions ? prettyJson(defaultValues.conditions) : '[]',
      actions_json: defaultValues?.actions ? prettyJson(defaultValues.actions) : '[\n  {\n    "type": "mqtt_publish",\n    "topic": "cmnd/device/Power",\n    "payload": "ON"\n  }\n]',
    },
  })

  const onSubmit = handleSubmit(async (data) => {
    try {
      const parsed = {
        name: data.name,
        description: data.description || null,
        trigger: JSON.parse(data.trigger_json),
        conditions: JSON.parse(data.conditions_json),
        actions: JSON.parse(data.actions_json),
      }
      if (defaultValues?.id) {
        await updateAutomation.mutateAsync(parsed)
      } else {
        await createAutomation.mutateAsync(parsed)
      }
      addToast({ title: defaultValues?.id ? 'Automation updated' : 'Automation created', variant: 'success' })
      onClose()
    } catch (e) {
      const msg = e instanceof SyntaxError ? 'Invalid JSON in trigger/conditions/actions' : 'Failed to save automation'
      addToast({ title: msg, variant: 'error' })
    }
  })

  const isLoading = createAutomation.isPending || updateAutomation.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={defaultValues?.id ? 'Edit Automation' : 'New Automation'}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={isLoading} onClick={onSubmit}>
            {defaultValues?.id ? 'Save Changes' : 'Create Automation'}
          </Button>
        </>
      }
    >
      <form className="space-y-4">
        <Input label="Name" placeholder="Turn on lights when motion detected" error={errors.name?.message} {...register('name')} />
        <Input label="Description" placeholder="Optional description" {...register('description', { setValueAs: (v) => v || null })} />
        <Textarea
          label="Trigger (JSON)"
          rows={5}
          className="font-mono text-xs"
          error={errors.trigger_json?.message}
          hint='{ "type": "state_change" | "schedule" | "mqtt" | "manual" }'
          {...register('trigger_json')}
        />
        <Textarea
          label="Conditions (JSON array)"
          rows={3}
          className="font-mono text-xs"
          error={errors.conditions_json?.message}
          hint="Leave as [] for no conditions"
          {...register('conditions_json')}
        />
        <Textarea
          label="Actions (JSON array)"
          rows={5}
          className="font-mono text-xs"
          error={errors.actions_json?.message}
          hint='[{ "type": "mqtt_publish", "topic": "...", "payload": "..." }]'
          {...register('actions_json')}
        />
      </form>
    </Modal>
  )
}

export default function AutomationsPage() {
  const { data: automations = [], isLoading } = useAutomations()
  const toggleAutomation = useToggleAutomation()
  const deleteAutomation = useDeleteAutomation()
  const testAutomation = useTestAutomation()
  const { addToast } = useAppStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editAutomation, setEditAutomation] = useState<Automation | null>(null)

  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      await toggleAutomation.mutateAsync({ id, enabled })
      addToast({ title: `Automation ${enabled ? 'enabled' : 'disabled'}`, variant: 'success' })
    } catch {
      addToast({ title: 'Failed to toggle automation', variant: 'error' })
    }
  }

  const handleTest = async (id: number, name: string) => {
    try {
      const result = await testAutomation.mutateAsync(id)
      addToast({
        title: `Test: ${name}`,
        description: result.success ? `Success: ${result.result}` : `Failed: ${result.result}`,
        variant: result.success ? 'success' : 'error',
        duration: 6000,
      })
    } catch {
      addToast({ title: 'Test failed', variant: 'error' })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this automation?')) return
    try {
      await deleteAutomation.mutateAsync(id)
      addToast({ title: 'Automation deleted', variant: 'success' })
    } catch {
      addToast({ title: 'Failed to delete automation', variant: 'error' })
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Automations</h1>
          <p className="text-sm text-foreground-muted">{automations.length} automations configured</p>
        </div>
        <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditAutomation(null); setModalOpen(true) }}>
          New Automation
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : automations.length === 0 ? (
        <EmptyState
          icon={<Zap className="h-8 w-8" />}
          title="No automations yet"
          description="Create automations to trigger actions based on device states, schedules, or MQTT messages"
          action={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditAutomation(null); setModalOpen(true) }}>New Automation</Button>}
        />
      ) : (
        <div className="space-y-3">
          {automations.map((automation) => (
            <div
              key={automation.id}
              className={`rounded-xl border bg-card p-5 shadow-card transition-all ${automation.enabled ? 'border-border' : 'border-border opacity-60'}`}
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${automation.enabled ? 'bg-accent/10 text-accent' : 'bg-surface text-foreground-dim'}`}>
                  <Zap className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{automation.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${automation.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                      {automation.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  {automation.description && (
                    <p className="mt-0.5 text-sm text-foreground-muted">{automation.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-foreground-dim">
                    <span className="flex items-center gap-1">
                      <span className="font-mono bg-surface rounded px-1.5 py-0.5 text-blue-400">{automation.trigger.type}</span>
                      trigger
                    </span>
                    <span>{automation.conditions.length} conditions</span>
                    <span>{automation.actions.length} actions</span>
                    <span>{automation.trigger_count} runs total</span>
                    {automation.last_triggered && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(automation.last_triggered)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(automation.id, !automation.enabled)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${automation.enabled ? 'bg-accent' : 'bg-slate-600'}`}
                    aria-label={automation.enabled ? 'Disable automation' : 'Enable automation'}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${automation.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<Play className="h-3 w-3" />}
                    onClick={() => handleTest(automation.id, automation.name)}
                    loading={testAutomation.isPending}
                    aria-label={`Test ${automation.name}`}
                  >
                    Test
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => { setEditAutomation(automation); setModalOpen(true) }}
                    aria-label="Edit automation"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="danger"
                    onClick={() => handleDelete(automation.id)}
                    aria-label="Delete automation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AutomationFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditAutomation(null) }}
        defaultValues={editAutomation}
      />
    </div>
  )
}
