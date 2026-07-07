'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Input } from '@gitroom/react/form/input';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

interface AiSettingsResponse {
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
}

export const useAiSettings = () => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return (await fetch('/settings/ai')).json();
  }, []);

  return useSWR<AiSettingsResponse>('ai-settings', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
  });
};

const AiSettingsComponent = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { data, isLoading, mutate } = useAiSettings();

  const [form, setForm] = useState({
    aiBaseUrl: '',
    aiApiKey: '',
    aiModel: '',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        aiBaseUrl: data.aiBaseUrl || '',
        aiApiKey: data.aiApiKey || '',
        aiModel: data.aiModel || '',
      });
    }
  }, [data]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/settings/ai', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      mutate(form);
      toaster.show(t('settings_updated', 'Settings updated'), 'success');
    } catch (e) {
      toaster.show(t('settings_error', 'Error updating settings'), 'warning');
    } finally {
      setSaving(false);
    }
  }, [fetch, form, mutate, toaster, t]);

  if (isLoading) {
    return (
      <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px]">
        <div className="animate-pulse">{t('loading', 'Loading AI Settings...')}</div>
      </div>
    );
  }

  return (
    <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[24px]">
      <div className="flex flex-col gap-[8px]">
        <div className="text-[16px] font-semibold">
          {t('ai_provider_settings', 'Custom AI Provider')}
        </div>
        <div className="text-[12px] text-customColor18">
          {t(
            'ai_provider_description',
            'Configure your own OpenAI-compatible provider (e.g. OpenRouter, Groq, Azure, Local LLM).'
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
        <Input
          name="aiBaseUrl"
          label={t('ai_base_url', 'API Base URL')}
          placeholder="https://api.openai.com/v1"
          value={form.aiBaseUrl}
          onChange={handleChange}
        />
        <Input
          name="aiApiKey"
          label={t('ai_api_key', 'API Key')}
          placeholder="sk-..."
          type="password"
          value={form.aiApiKey}
          onChange={handleChange}
        />
        <Input
          name="aiModel"
          label={t('ai_model', 'Model Name')}
          placeholder="gpt-4o"
          value={form.aiModel}
          onChange={handleChange}
        />
      </div>

      <div className="flex justify-end mt-[8px]">
        <Button
          onClick={save}
          loading={saving}
          color="primary"
          className="w-full md:w-[200px]"
        >
          {t('save_ai_settings', 'Save AI Configuration')}
        </Button>
      </div>
    </div>
  );
};

export default AiSettingsComponent;
