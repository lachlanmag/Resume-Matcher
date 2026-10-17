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
<<<<<<< HEAD
import { Experience } from '@/components/dashboard/resume-component';
import { TextAlignLeft, Copy, ListBullets, Plus, Trash } from '@phosphor-icons/react';
=======
import { Experience, ExperienceRole } from '@/components/dashboard/resume-component';
import { Plus, Trash2 } from 'lucide-react';
>>>>>>> origin/main
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
<<<<<<< HEAD
  const fieldId = useId();
=======

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = data.findIndex((item) => item.id === active.id);
    const newIndex = data.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onChange(arrayMove(data, oldIndex, newIndex));
  };
>>>>>>> origin/main

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

<<<<<<< HEAD
  const handleCondensedChange = (id: number, condensed: boolean) => {
    onChange(data.map((item) => (item.id === id ? { ...item, condensed } : item)));
  };

  const handleDescriptionChange = (id: number, index: number, value: string) => {
    onChange(
      data.map((item) => {
        if (item.id === id) {
          const newDesc = [...(item.description || [])];
          newDesc[index] = value;
          return { ...item, description: newDesc };
        }
        return item;
      })
    );
  };

  const handleAddDescription = (id: number) => {
    onChange(
      data.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            description: [...(item.description || []), ''],
            descriptionStyles: [...(item.descriptionStyles || []), 'bullet'],
          };
        }
        return item;
      })
    );
  };

  const handleToggleDescriptionStyle = (id: number, index: number) => {
    onChange(
      data.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            descriptionStyles: toggleDescriptionStyle(
              item.description,
              item.descriptionStyles,
              index
            ),
          };
        }
        return item;
      })
    );
  };

  const handleReorderDescriptions = (id: number, rows: DescriptionRow[]) => {
    onChange(
      data.map((item) => (item.id === id ? { ...item, ...fromDescriptionRows(rows) } : item))
    );
  };

  const handleRemoveDescription = (id: number, index: number) => {
    onChange(
      data.map((item) => {
        if (item.id === id) {
          const newDesc = [...(item.description || [])];
          newDesc.splice(index, 1);
          const newStyles = alignDescriptionStyles(item.description, item.descriptionStyles);
          newStyles.splice(index, 1);
          return { ...item, description: newDesc, descriptionStyles: newStyles };
        }
        return item;
      })
    );
=======
  const handleJobFieldChange = (jobId: number, field: 'company' | 'location', value: string) => {
    updateJob(jobId, (job) => ({ ...job, [field]: value }));
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
      return {
        ...job,
        roles: [...roles, { id: newRoleId, title: '', years: '' }],
      };
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
    }));
  };

  const handleRemoveDescription = (jobId: number, index: number) => {
    updateJob(jobId, (job) => {
      const newDesc = [...(job.description || [])];
      newDesc.splice(index, 1);
      return { ...job, description: newDesc };
    });
>>>>>>> origin/main
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
<<<<<<< HEAD
        <Button variant="outline" size="sm" onClick={handleAdd}>
          <Plus aria-hidden="true" />
          {t('builder.forms.experience.addJob')}
=======
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddJob}
          className="rounded-none border-black hover:bg-black hover:text-white transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" /> {t('builder.forms.experience.addJob')}
>>>>>>> origin/main
        </Button>
      </div>

      {data.length === 0 ? (
<<<<<<< HEAD
        <EmptyState
          variant="framed"
          title={t('builder.genericItemForm.noEntries', { label: t('resume.sections.experience') })}
          action={
            <Button variant="outline" size="sm" onClick={handleAdd}>
              <Plus aria-hidden="true" />
              {t('builder.forms.experience.addFirstJob')}
            </Button>
          }
        />
      ) : (
        <SortableItemList id="experience-items" items={data} onReorder={onChange} animateItems>
          {(item) => (
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
                onClick={() => handleRemove(item.id)}
                aria-label={t('a11y.removeItem')}
                title={t('a11y.removeItem')}
              >
                <Trash aria-hidden="true" />
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pr-24">
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-${item.id}-title`}>
                    {t('builder.forms.experience.fields.jobTitle')}
                  </Label>
                  <Input
                    id={`${fieldId}-${item.id}-title`}
                    value={item.title || ''}
                    onChange={(e) => handleChange(item.id, 'title', e.target.value)}
                    placeholder={t('builder.forms.experience.placeholders.jobTitle')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-${item.id}-company`}>
                    {t('builder.forms.experience.fields.company')}
                  </Label>
                  <Input
                    id={`${fieldId}-${item.id}-company`}
                    value={item.company || ''}
                    onChange={(e) => handleChange(item.id, 'company', e.target.value)}
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
                    onChange={(e) => handleChange(item.id, 'location', e.target.value)}
                    placeholder={t('builder.forms.experience.placeholders.location')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-${item.id}-years`}>
                    {t('builder.genericItemForm.fields.years')}
                  </Label>
                  <Input
                    id={`${fieldId}-${item.id}-years`}
                    value={item.years || ''}
                    onChange={(e) => handleChange(item.id, 'years', e.target.value)}
                    placeholder={t('builder.forms.experience.placeholders.years')}
                  />
                </div>
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
=======
        <div className="text-center py-12 bg-paper-tint border border-dashed border-black">
          <p className="font-mono text-sm text-steel-grey mb-4">
            {t('builder.genericItemForm.noEntries', { label: t('resume.sections.experience') })}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddJob}
            className="rounded-none border-black"
          >
            <Plus className="w-4 h-4 mr-2" /> {t('builder.forms.experience.addFirstJob')}
          </Button>
        </div>
      ) : (
        <DndContext id="experience-entries" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={data.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-8">
              {data.map((item) => {
                const roles = item.roles?.length
                  ? item.roles
                  : [{ id: 1, title: '', years: '' }];

                return (
                  <DraggableListItem key={item.id} id={item.id}>
                    <div className="p-6 border border-black bg-paper-tint relative group">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveJob(item.id)}
                        aria-label={t('a11y.removeItem')}
                        title={t('a11y.removeItem')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pr-8">
                        <div className="space-y-2">
                          <Label className="font-mono text-xs uppercase tracking-wider text-steel-grey">
                            {t('builder.forms.experience.fields.company')}
                          </Label>
                          <Input
                            value={item.company || ''}
                            onChange={(e) =>
                              handleJobFieldChange(item.id, 'company', e.target.value)
                            }
                            placeholder={t('builder.forms.experience.placeholders.company')}
                            className="rounded-none border-black bg-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-mono text-xs uppercase tracking-wider text-steel-grey">
                            {t('builder.genericItemForm.fields.location')}
                          </Label>
                          <Input
                            value={item.location || ''}
                            onChange={(e) =>
                              handleJobFieldChange(item.id, 'location', e.target.value)
                            }
                            placeholder={t('builder.forms.experience.placeholders.location')}
                            className="rounded-none border-black bg-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-4 mb-6">
                        <div className="flex justify-between items-center">
                          <Label className="font-mono text-xs uppercase tracking-wider text-steel-grey">
                            {t('builder.forms.experience.fields.roles')}
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddRole(item.id)}
                            className="h-6 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                          >
                            <Plus className="w-3 h-3 mr-1" />{' '}
                            {t('builder.forms.experience.actions.addRole')}
                          </Button>
                        </div>

                        {roles.map((role) => (
                          <div
                            key={`${item.id}-${role.id}`}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-black/20 bg-white relative"
                          >
                            {roles.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1 right-1 h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveRole(item.id, role.id)}
                                aria-label={t('builder.forms.experience.actions.removeRole')}
                                title={t('builder.forms.experience.actions.removeRole')}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                            <div className="space-y-2 md:pr-8">
                              <Label className="font-mono text-xs uppercase tracking-wider text-steel-grey">
                                {t('builder.forms.experience.fields.roleTitle')}
                              </Label>
                              <Input
                                value={role.title || ''}
                                onChange={(e) =>
                                  handleRoleChange(item.id, role.id, 'title', e.target.value)
                                }
                                placeholder={t('builder.forms.experience.placeholders.jobTitle')}
                                className="rounded-none border-black bg-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="font-mono text-xs uppercase tracking-wider text-steel-grey">
                                {t('builder.genericItemForm.fields.years')}
                              </Label>
                              <Input
                                value={role.years || ''}
                                onChange={(e) =>
                                  handleRoleChange(item.id, role.id, 'years', e.target.value)
                                }
                                placeholder={t('builder.forms.experience.placeholders.years')}
                                className="rounded-none border-black bg-white"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <Label className="font-mono text-xs uppercase tracking-wider text-steel-grey">
                            {t('builder.genericItemForm.fields.descriptionPoints')}
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddDescription(item.id)}
                            className="h-6 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                          >
                            <Plus className="w-3 h-3 mr-1" />{' '}
                            {t('builder.genericItemForm.actions.addPoint')}
                          </Button>
                        </div>
                        {item.description?.map((desc, idx) => (
                          <div key={idx} className="flex gap-2">
                            <div className="flex-1">
                              <RichTextEditor
                                value={desc}
                                onChange={(html) =>
                                  handleDescriptionChange(item.id, idx, html)
                                }
                                placeholder={t('builder.forms.experience.placeholders.description')}
                                minHeight="60px"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveDescription(item.id, idx)}
                              className="h-[60px] w-8 text-muted-foreground hover:text-destructive self-end"
                              aria-label={t('a11y.removeDescription')}
                              title={t('a11y.removeDescription')}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </DraggableListItem>
                );
              })}
>>>>>>> origin/main
            </div>
          )}
        </SortableItemList>
      )}
    </div>
  );
};
