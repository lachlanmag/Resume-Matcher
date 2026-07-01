'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[100px] border border-black bg-transparent" aria-busy="true" />
    ),
  }
);
import { Experience, ExperienceRole } from '@/components/dashboard/resume-component';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DraggableListItem } from '../draggable-list-item';

interface ExperienceFormProps {
  data: Experience[];
  onChange: (data: Experience[]) => void;
}

export const ExperienceForm: React.FC<ExperienceFormProps> = ({ data, onChange }) => {
  const { t } = useTranslations();

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
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddJob}
          className="rounded-none border-black hover:bg-black hover:text-white transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" /> {t('builder.forms.experience.addJob')}
        </Button>
      </div>

      {data.length === 0 ? (
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
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};
