'use client';

import React, { useId } from 'react';
import dynamic from 'next/dynamic';
import { Input } from '@/components/ui/input';
import { Label, labelClass } from '@/components/ui/label';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[100px] border border-ink bg-transparent" aria-busy="true" />
    ),
  }
);
import { Experience, ExperienceRole } from '@/components/dashboard/resume-component';
import { TextAlignLeft, Copy, ListBullets, Plus, Trash } from '@phosphor-icons/react';
import { useTranslations } from '@/lib/i18n';
import {
  alignDescriptionStyles,
  fromDescriptionRows,
  toDescriptionRows,
  toggleDescriptionStyle,
  type DescriptionRow,
} from '@/lib/utils/description-styles';
import { SortableItemList } from '../sortable-item-list';
import { duplicateById } from '@/lib/utils/reorder-items';

interface ExperienceFormProps {
  data: Experience[];
  onChange: (data: Experience[]) => void;
}

export const ExperienceForm: React.FC<ExperienceFormProps> = ({ data, onChange }) => {
  const { t } = useTranslations();
  const fieldId = useId();

  const handleAddJob = () => {
    const newId = Math.max(...data.map((d) => d.id), 0) + 1;
    onChange([
      ...data,
      {
        id: newId,
        company: '',
        location: '',
        roles: [{ id: 1, title: '', years: '' }],
        description: [''],
        descriptionStyles: ['bullet'],
      },
    ]);
  };

  const handleRemoveJob = (id: number) => {
    onChange(data.filter((item) => item.id !== id));
  };

  const updateJob = (jobId: number, updater: (job: Experience) => Experience) => {
    onChange(data.map((item) => (item.id === jobId ? updater(item) : item)));
  };

  const handleJobFieldChange = (jobId: number, field: 'company' | 'location', value: string) => {
    updateJob(jobId, (job) => ({ ...job, [field]: value }));
  };

  const handleCondensedChange = (jobId: number, condensed: boolean) => {
    updateJob(jobId, (job) => ({ ...job, condensed }));
  };

  const handleRoleChange = (
    jobId: number,
    roleId: number,
    field: keyof ExperienceRole,
    value: string
  ) => {
    updateJob(jobId, (job) => ({
      ...job,
      roles: (job.roles || []).map((role) =>
        role.id === roleId ? { ...role, [field]: value } : role
      ),
    }));
  };

  const handleAddRole = (jobId: number) => {
    updateJob(jobId, (job) => {
      const roles = job.roles || [];
      const newRoleId = Math.max(...roles.map((r) => r.id), 0) + 1;
      return { ...job, roles: [...roles, { id: newRoleId, title: '', years: '' }] };
    });
  };

  const handleRemoveRole = (jobId: number, roleId: number) => {
    updateJob(jobId, (job) => {
      const roles = job.roles || [];
      if (roles.length <= 1) return job;
      return { ...job, roles: roles.filter((role) => role.id !== roleId) };
    });
  };

  const handleDescriptionChange = (jobId: number, index: number, value: string) => {
    updateJob(jobId, (job) => {
      const newDesc = [...(job.description || [])];
      newDesc[index] = value;
      return { ...job, description: newDesc };
    });
  };

  const handleAddDescription = (jobId: number) => {
    updateJob(jobId, (job) => ({
      ...job,
      description: [...(job.description || []), ''],
      descriptionStyles: [
        ...alignDescriptionStyles(job.description, job.descriptionStyles),
        'bullet',
      ],
    }));
  };

  const handleToggleDescriptionStyle = (jobId: number, index: number) => {
    updateJob(jobId, (job) => ({
      ...job,
      descriptionStyles: toggleDescriptionStyle(job.description, job.descriptionStyles, index),
    }));
  };

  const handleReorderDescriptions = (jobId: number, rows: DescriptionRow[]) => {
    updateJob(jobId, (job) => ({ ...job, ...fromDescriptionRows(rows) }));
  };

  const handleRemoveDescription = (jobId: number, index: number) => {
    updateJob(jobId, (job) => {
      const newDesc = [...(job.description || [])];
      newDesc.splice(index, 1);
      const newStyles = alignDescriptionStyles(job.description, job.descriptionStyles);
      newStyles.splice(index, 1);
      return { ...job, description: newDesc, descriptionStyles: newStyles };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleAddJob}>
          <Plus aria-hidden="true" />
          {t('builder.forms.experience.addJob')}
        </Button>
      </div>

      {data.length === 0 ? (
        <EmptyState
          variant="framed"
          title={t('builder.genericItemForm.noEntries', { label: t('resume.sections.experience') })}
          action={
            <Button variant="outline" size="sm" onClick={handleAddJob}>
              <Plus aria-hidden="true" />
              {t('builder.forms.experience.addFirstJob')}
            </Button>
          }
        />
      ) : (
        <SortableItemList id="experience-items" items={data} onReorder={onChange} animateItems>
          {(item) => {
            const roles = item.roles?.length ? item.roles : [{ id: 1, title: '', years: '' }];
            return (
              <div className="p-6 border border-ink bg-paper relative group">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-16 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-steel hover:text-ink-soft"
                  onClick={() => onChange(duplicateById(data, item.id))}
                  aria-label={t('a11y.duplicateItem')}
                  title={t('a11y.duplicateItem')}
                >
                  <Copy aria-hidden="true" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive-tint"
                  onClick={() => handleRemoveJob(item.id)}
                  aria-label={t('a11y.removeItem')}
                  title={t('a11y.removeItem')}
                >
                  <Trash aria-hidden="true" />
                </Button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pr-24">
                  <div className="space-y-2">
                    <Label htmlFor={`${fieldId}-${item.id}-company`}>
                      {t('builder.forms.experience.fields.company')}
                    </Label>
                    <Input
                      id={`${fieldId}-${item.id}-company`}
                      value={item.company || ''}
                      onChange={(e) => handleJobFieldChange(item.id, 'company', e.target.value)}
                      placeholder={t('builder.forms.experience.placeholders.company')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${fieldId}-${item.id}-location`}>
                      {t('builder.genericItemForm.fields.location')}
                    </Label>
                    <Input
                      id={`${fieldId}-${item.id}-location`}
                      value={item.location || ''}
                      onChange={(e) => handleJobFieldChange(item.id, 'location', e.target.value)}
                      placeholder={t('builder.forms.experience.placeholders.location')}
                    />
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className={labelClass}>{t('builder.forms.experience.fields.roles')}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddRole(item.id)}
                      className="h-6 text-xs text-primary hover:text-primary-hover hover:bg-info-tint"
                    >
                      <Plus aria-hidden="true" />
                      {t('builder.forms.experience.actions.addRole')}
                    </Button>
                  </div>

                  {roles.map((role) => (
                    <div
                      key={`${item.id}-${role.id}`}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-ink bg-white relative"
                    >
                      {roles.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="absolute top-1 right-1 text-steel hover:text-destructive"
                          onClick={() => handleRemoveRole(item.id, role.id)}
                          aria-label={t('builder.forms.experience.actions.removeRole')}
                          title={t('builder.forms.experience.actions.removeRole')}
                        >
                          <Trash aria-hidden="true" />
                        </Button>
                      )}
                      <div className="space-y-2 md:pr-8">
                        <Label htmlFor={`${fieldId}-${item.id}-${role.id}-title`}>
                          {t('builder.forms.experience.fields.roleTitle')}
                        </Label>
                        <Input
                          id={`${fieldId}-${item.id}-${role.id}-title`}
                          value={role.title || ''}
                          onChange={(e) =>
                            handleRoleChange(item.id, role.id, 'title', e.target.value)
                          }
                          placeholder={t('builder.forms.experience.placeholders.jobTitle')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${fieldId}-${item.id}-${role.id}-years`}>
                          {t('builder.genericItemForm.fields.years')}
                        </Label>
                        <Input
                          id={`${fieldId}-${item.id}-${role.id}-years`}
                          value={role.years || ''}
                          onChange={(e) =>
                            handleRoleChange(item.id, role.id, 'years', e.target.value)
                          }
                          placeholder={t('builder.forms.experience.placeholders.years')}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <ToggleSwitch
                  variant="inline"
                  checked={Boolean(item.condensed)}
                  onCheckedChange={(checked) => handleCondensedChange(item.id, checked)}
                  label={t('builder.forms.experience.condense.label')}
                  description={t('builder.forms.experience.condense.description')}
                />

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className={labelClass}>
                      {t('builder.genericItemForm.fields.descriptionPoints')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddDescription(item.id)}
                      className="h-6 text-xs text-primary hover:text-primary-hover hover:bg-info-tint"
                    >
                      <Plus aria-hidden="true" />
                      {t('builder.genericItemForm.actions.addPoint')}
                    </Button>
                  </div>
                  {item.description?.length ? (
                    <SortableItemList
                      id={`experience-${item.id}-points`}
                      items={toDescriptionRows(item.description, item.descriptionStyles)}
                      onReorder={(rows) => handleReorderDescriptions(item.id, rows)}
                      className="space-y-3"
                      handleLabel={t('builder.genericItemForm.actions.reorderPoint')}
                    >
                      {({ text: desc, style }, idx) => (
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <RichTextEditor
                              value={desc}
                              onChange={(html) => handleDescriptionChange(item.id, idx, html)}
                              placeholder={t('builder.forms.experience.placeholders.description')}
                              minHeight="60px"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleToggleDescriptionStyle(item.id, idx)}
                            className="text-steel hover:text-primary self-end"
                            aria-label={t('builder.genericItemForm.actions.togglePointStyle')}
                            title={t('builder.genericItemForm.actions.togglePointStyle')}
                          >
                            {style === 'plain' ? (
                              <TextAlignLeft aria-hidden="true" />
                            ) : (
                              <ListBullets aria-hidden="true" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleRemoveDescription(item.id, idx)}
                            className="text-steel hover:text-destructive self-end"
                            aria-label={t('a11y.removeDescription')}
                            title={t('a11y.removeDescription')}
                          >
                            <Trash aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </SortableItemList>
                  ) : null}
                </div>
              </div>
            );
          }}
        </SortableItemList>
      )}
    </div>
  );
};
