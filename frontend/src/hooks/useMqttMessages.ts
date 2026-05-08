'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { mqttApi } from '@/lib/api'

export function useMqttMessages() {
  const { mqttMessages, mqttPaused, clearMqttMessages, toggleMqttPaused } = useAppStore()
  return { messages: mqttMessages, paused: mqttPaused, clear: clearMqttMessages, togglePause: toggleMqttPaused }
}

export function useMqttHistory(limit = 100, topic?: string) {
  return useQuery({
    queryKey: ['mqtt-history', limit, topic],
    queryFn: () => mqttApi.getHistory(limit, topic),
    staleTime: 10_000,
  })
}

export function useMqttTopicStats() {
  return useQuery({
    queryKey: ['mqtt-topic-stats'],
    queryFn: () => mqttApi.getTopicStats(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function usePublishMqtt() {
  return useMutation({
    mutationFn: ({ topic, payload, qos }: { topic: string; payload: string; qos?: number }) =>
      mqttApi.publish(topic, payload, qos),
  })
}
