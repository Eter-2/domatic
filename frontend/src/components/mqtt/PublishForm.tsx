'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Send } from 'lucide-react'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { usePublishMqtt } from '@/hooks/useMqttMessages'
import { useAppStore } from '@/lib/store'

const schema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  payload: z.string().min(1, 'Payload is required'),
  qos: z.number().min(0).max(2),
})

type FormData = z.infer<typeof schema>

export function PublishForm() {
  const publish = usePublishMqtt()
  const { addToast } = useAppStore()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { topic: '', payload: '', qos: 0 },
  })

  const onSubmit = handleSubmit(async (data) => {
    try {
      await publish.mutateAsync(data)
      addToast({ title: 'Message published', variant: 'success' })
      reset({ topic: data.topic, payload: '', qos: data.qos })
    } catch {
      addToast({ title: 'Publish failed', variant: 'error' })
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Input
            label="Topic"
            placeholder="cmnd/sonoff01/Power"
            error={errors.topic?.message}
            className="font-mono text-xs"
            {...register('topic')}
          />
        </div>
        <Select
          label="QoS"
          options={[
            { label: 'QoS 0', value: 0 },
            { label: 'QoS 1', value: 1 },
            { label: 'QoS 2', value: 2 },
          ]}
          {...register('qos', { valueAsNumber: true })}
        />
      </div>
      <Textarea
        label="Payload"
        placeholder='ON  or  {"POWER":"TOGGLE"}  or  1'
        rows={3}
        error={errors.payload?.message}
        className="font-mono text-xs"
        {...register('payload')}
      />
      <Button
        type="submit"
        variant="primary"
        leftIcon={<Send className="h-3.5 w-3.5" />}
        loading={publish.isPending}
      >
        Publish
      </Button>
    </form>
  )
}
