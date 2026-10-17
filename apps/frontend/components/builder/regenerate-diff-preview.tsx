'use client';

import React from 'react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
<<<<<<< HEAD
import { Alert } from '@/components/ui/alert';
import { Check, ArrowsClockwise, CaretDown, CaretRight, SpinnerGap } from '@phosphor-icons/react';
=======
import {
  Check,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Briefcase,
  FolderKanban,
  Lightbulb,
  FileText,
} from 'lucide-react';
>>>>>>> origin/main
import { useTranslations } from '@/lib/i18n';
import type { RegenerateItemError, RegeneratedItem } from '@/lib/api/enrichment';

interface RegenerateDiffPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regeneratedItems: RegeneratedItem[];
  regenerateErrors?: RegenerateItemError[];
  error: string | null;
  onAccept: () => void;
  onReject: () => void;
  isApplying: boolean;
<<<<<<< HEAD
  needsRefresh?: boolean;
=======
  /**
   * Render the diff content inline (no portal/overlay) so it can live inside
   * another modal (e.g. the native <dialog> feedback flow). A portaled Dialog
   * would paint behind a top-layer native dialog and appear blank.
   */
  embedded?: boolean;
>>>>>>> origin/main
}

/**
 * RegenerateDiffPreview Component
 *
 * Third step of the regenerate wizard.
 * Shows side-by-side comparison of original vs regenerated content.
 * Swiss International Style design.
 */
export const RegenerateDiffPreview: React.FC<RegenerateDiffPreviewProps> = ({
  open,
  onOpenChange,
  regeneratedItems,
  regenerateErrors = [],
  error,
  onAccept,
  onReject,
  isApplying,
<<<<<<< HEAD
  needsRefresh = false,
=======
  embedded = false,
>>>>>>> origin/main
}) => {
  const { t } = useTranslations();
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(
    new Set(regeneratedItems.map((item) => item.item_id))
  );

  React.useEffect(() => {
    // Expand all items when regeneratedItems changes
    setExpandedItems(new Set(regeneratedItems.map((item) => item.item_id)));
  }, [regeneratedItems]);

  const toggleItem = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  type ItemLabelSource = Pick<RegeneratedItem, 'item_id' | 'item_type' | 'title' | 'subtitle'>;

  const getItemLabel = (item: ItemLabelSource) => {
    if (item.item_type === 'skills') {
      return t('builder.regenerate.selectDialog.skills');
    }
    if (item.item_type === 'summary') {
      return t('builder.regenerate.selectDialog.summary');
    }

    const title = item.title?.trim();
    const subtitle = item.subtitle?.trim();

    if (title && subtitle) {
      return `${title} | ${subtitle}`;
    }

    return title || item.item_id;
  };

<<<<<<< HEAD
=======
  const getItemIcon = (itemType: string) => {
    switch (itemType) {
      case 'experience':
        return <Briefcase className="w-4 h-4" />;
      case 'project':
        return <FolderKanban className="w-4 h-4" />;
      case 'skills':
        return <Lightbulb className="w-4 h-4" />;
      case 'summary':
        return <FileText className="w-4 h-4" />;
      default:
        return null;
    }
  };

>>>>>>> origin/main
  const resolveErrorMessage = (value: string) => {
    if (value === 'No changes to apply') {
      return t('builder.regenerate.errors.noChangesToApply');
    }

    if (/network|fetch/i.test(value) || value.includes('Failed to fetch')) {
      return t('builder.regenerate.errors.networkError');
    }

    if (/resume content changed|uniquely matched|please regenerate/i.test(value)) {
      return t('builder.regenerate.errors.resumeChanged');
    }

    return t('builder.regenerate.errors.applyFailed');
  };

  const statsCard = (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 text-green-700 font-mono text-xs">
      <Check className="w-3 h-3" />
      {t('builder.regenerate.diffPreview.changesCount').replace(
        '{count}',
        String(regeneratedItems.length)
      )}
    </div>
  );

  const errorBlock = error ? (
    <div className="border border-red-600 bg-red-50 px-4 py-3">
      <p className="font-mono text-xs text-red-700">{resolveErrorMessage(error)}</p>
    </div>
  ) : null;

  const partialFailuresBlock =
    regenerateErrors.length > 0 ? (
      <div className="border border-black bg-[#FFF9DB] px-4 py-3">
        <p className="font-mono text-xs text-ink-soft">
          {t('builder.regenerate.diffPreview.partialFailures', {
            count: regenerateErrors.length,
          })}
        </p>
        <ul className="mt-2 space-y-1">
          {regenerateErrors.map((failed) => (
            <li key={failed.item_id} className="font-mono text-xs text-ink-soft">
              • {getItemLabel(failed)}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const diffList = regeneratedItems.map((item) => (
    <div key={item.item_id} className="border border-black">
      {/* Item Header */}
      <button
        type="button"
        onClick={() => toggleItem(item.item_id)}
        aria-expanded={expandedItems.has(item.item_id)}
        aria-label={
          expandedItems.has(item.item_id)
            ? t('builder.regenerate.diffPreview.collapseItem', { item: getItemLabel(item) })
            : t('builder.regenerate.diffPreview.expandItem', { item: getItemLabel(item) })
        }
        className="w-full p-4 flex items-center justify-between bg-background hover:bg-secondary transition-colors"
      >
        <div className="flex items-center gap-3">
          {getItemIcon(item.item_type)}
          <span className="font-mono text-sm tracking-wider font-medium truncate">
            {getItemLabel(item)}
          </span>
        </div>
        {expandedItems.has(item.item_id) ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Item Diff Content */}
      {expandedItems.has(item.item_id) && (
        <div className="border-t border-black">
          {/* Change Summary */}
          {item.diff_summary && (
            <div className="p-3 border-b border-black">
              <p className="font-mono text-xs text-blue-700">{item.diff_summary}</p>
            </div>
          )}

          {/* Original Content */}
          <div className="p-4 border-b border-black">
            <div className="font-mono text-xs uppercase tracking-wider text-steel-grey mb-2 flex items-center gap-2">
              <span className="w-3 h-3 bg-red-600 border border-black" />
              {t('builder.regenerate.diffPreview.originalLabel')}
            </div>
            <div className="border-2 border-black bg-white p-3 space-y-1">
              {item.original_content.length > 0 ? (
                item.item_type === 'summary' ? (
                  <p className="text-sm text-red-700 line-through">
                    <span className="font-mono mr-2">−</span>
                    {item.original_content.join(' ')}
                  </p>
                ) : (
                  item.original_content.map((content, idx) => (
                    <p key={idx} className="text-sm text-red-700 line-through">
                      <span className="font-mono mr-2">−</span>
                      {content}
                    </p>
                  ))
                )
              ) : (
                <p className="text-sm text-steel-grey italic">
                  {t('builder.regenerate.diffPreview.noContent')}
                </p>
              )}
            </div>
          </div>

          {/* New Content */}
          <div className="p-4">
            <div className="font-mono text-xs uppercase tracking-wider text-steel-grey mb-2 flex items-center gap-2">
              <span className="w-3 h-3 bg-green-700 border border-black" />
              {t('builder.regenerate.diffPreview.newLabel')}
            </div>
            <div className="border-2 border-black bg-white p-3 space-y-1">
              {item.new_content.length > 0 ? (
                item.item_type === 'summary' ? (
                  <p className="text-sm text-green-700">
                    <span className="font-mono mr-2">+</span>
                    {item.new_content.join(' ')}
                  </p>
                ) : (
                  item.new_content.map((content, idx) => (
                    <p key={idx} className="text-sm text-green-700">
                      <span className="font-mono mr-2">+</span>
                      {content}
                    </p>
                  ))
                )
              ) : (
                <p className="text-sm text-steel-grey italic">
                  {t('builder.regenerate.diffPreview.noContent')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  ));

  const footerButtons = (
    <>
      <Button
        variant="outline"
        onClick={onReject}
        disabled={isApplying}
        className="rounded-none border-black"
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        {t('builder.regenerate.diffPreview.rejectButton')}
      </Button>
      <Button variant="success" onClick={onAccept} disabled={isApplying} className="rounded-none">
        {isApplying ? (
          <>
            <span className="animate-spin mr-2">
              <Check className="w-4 h-4" />
            </span>
            {t('builder.regenerate.diffPreview.applying')}
          </>
        ) : (
          <>
            <Check className="w-4 h-4 mr-2" />
            {t('builder.regenerate.diffPreview.acceptButton')}
          </>
        )}
      </Button>
    </>
  );

  // Embedded mode: render inline (no portal) so the diff shows correctly when
  // nested inside a native <dialog> that owns the browser top layer.
  if (embedded) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="border-b border-black pb-4">
          <h2 className="font-serif text-xl font-bold uppercase tracking-tight">
            {t('builder.regenerate.diffPreview.title')}
          </h2>
          <p className="font-mono text-xs text-ink-soft mt-2">
            {t('builder.regenerate.diffPreview.subtitle')}
          </p>
        </div>

        <div className="pt-4">{statsCard}</div>
        {errorBlock ? <div className="pt-4">{errorBlock}</div> : null}
        {partialFailuresBlock ? <div className="pt-4">{partialFailuresBlock}</div> : null}

        <div className="flex-1 space-y-4 overflow-y-auto py-4">{diffList}</div>

        <div className="flex flex-row justify-between gap-3 border-t border-black bg-secondary p-4">
          {footerButtons}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{t('builder.regenerate.diffPreview.title')}</DialogTitle>
          <DialogDescription className="font-mono text-xs text-ink-soft">
            {t('builder.regenerate.diffPreview.subtitle')}
          </DialogDescription>
        </DialogHeader>

<<<<<<< HEAD
        <DialogBody className="space-y-4">
          {/* Stats Card */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-success-tint border border-success text-success font-mono text-xs tabular-nums">
              <Check aria-hidden="true" className="size-4" />
              {t('builder.regenerate.diffPreview.changesCount').replace(
                '{count}',
                String(regeneratedItems.length)
              )}
            </div>
          </div>

          {/* Diff Content */}
          <div className="space-y-4">
            {regeneratedItems.map((item) => (
              <div key={item.item_id} className="border border-ink">
                {/* Item Header */}
                <button
                  type="button"
                  onClick={() => toggleItem(item.item_id)}
                  aria-expanded={expandedItems.has(item.item_id)}
                  aria-label={
                    expandedItems.has(item.item_id)
                      ? t('builder.regenerate.diffPreview.collapseItem', {
                          item: getItemLabel(item),
                        })
                      : t('builder.regenerate.diffPreview.expandItem', { item: getItemLabel(item) })
                  }
                  className="w-full p-4 flex items-center justify-between bg-canvas hover:bg-panel transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <span className="font-mono text-sm tracking-wider font-medium truncate">
                    {getItemLabel(item)}
                  </span>
                  {expandedItems.has(item.item_id) ? (
                    <CaretDown aria-hidden="true" className="size-4" />
                  ) : (
                    <CaretRight aria-hidden="true" className="size-4" />
                  )}
                </button>

                {/* Item Diff Content */}
                {expandedItems.has(item.item_id) && (
                  <div className="border-t border-ink">
                    {/* Change Summary */}
                    {item.diff_summary && (
                      <div className="p-3 border-b border-ink">
                        <p className="font-mono text-xs text-ink">{item.diff_summary}</p>
                      </div>
                    )}

                    {/* Original Content */}
                    <div className="p-4 border-b border-ink">
                      <div className="font-mono text-xs uppercase tracking-wider text-steel mb-2 flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="size-3 bg-destructive border border-ink"
                        />
                        {t('builder.regenerate.diffPreview.originalLabel')}
                      </div>
                      <div className="border-2 border-ink bg-white p-3 space-y-1">
                        {item.original_content.length > 0 ? (
                          item.original_content.map((content, idx) => (
                            <p key={idx} className="text-sm text-destructive line-through">
                              <span className="font-mono mr-2">−</span>
                              {content}
                            </p>
                          ))
                        ) : (
                          <p className="text-sm text-steel italic">
                            {t('builder.regenerate.diffPreview.noContent')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* New Content */}
                    <div className="p-4">
                      <div className="font-mono text-xs uppercase tracking-wider text-steel mb-2 flex items-center gap-2">
                        <span aria-hidden="true" className="size-3 bg-success border border-ink" />
                        {t('builder.regenerate.diffPreview.newLabel')}
                      </div>
                      <div className="border-2 border-ink bg-white p-3 space-y-1">
                        {item.new_content.length > 0 ? (
                          item.new_content.map((content, idx) => (
                            <p key={idx} className="text-sm text-success">
                              <span className="font-mono mr-2">+</span>
                              {content}
                            </p>
                          ))
                        ) : (
                          <p className="text-sm text-steel italic">
                            {t('builder.regenerate.diffPreview.noContent')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogBody>

        {/* Pinned status: stays visible while the diff list scrolls */}
        {error || regenerateErrors.length > 0 ? (
          <div className="shrink-0 space-y-2 border-t border-ink px-6 py-3">
            {error ? (
              <Alert tone={needsRefresh ? 'warning' : 'error'} className="px-4 py-3">
                {needsRefresh
                  ? t('builder.regenerate.errors.refreshFailed')
                  : resolveErrorMessage(error)}
              </Alert>
            ) : null}

            {regenerateErrors.length > 0 ? (
              <Alert
                tone="warning"
                className="px-4 py-3"
                title={t('builder.regenerate.diffPreview.partialFailures', {
                  count: regenerateErrors.length,
                })}
              >
                <ul className="list-disc pl-4 marker:text-warning-text space-y-1">
                  {regenerateErrors.map((failed) => (
                    <li key={failed.item_id}>{getItemLabel(failed)}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="justify-between">
          <Button variant="outline" onClick={onReject} disabled={isApplying || needsRefresh}>
            <ArrowsClockwise aria-hidden="true" />
            {t('builder.regenerate.diffPreview.rejectButton')}
          </Button>
          <Button variant="success" onClick={onAccept} disabled={isApplying}>
            {isApplying ? (
              <>
                <SpinnerGap className="size-4 animate-spin" aria-hidden="true" />
                {t(
                  needsRefresh
                    ? 'builder.regenerate.diffPreview.refreshing'
                    : 'builder.regenerate.diffPreview.applying'
                )}
              </>
            ) : (
              <>
                <Check aria-hidden="true" />
                {t(
                  needsRefresh
                    ? 'builder.regenerate.diffPreview.retryRefresh'
                    : 'builder.regenerate.diffPreview.acceptButton'
                )}
              </>
            )}
          </Button>
=======
        {/* Stats Card */}
        <div className="px-6 pt-4">{statsCard}</div>

        {errorBlock ? <div className="px-6 pt-4">{errorBlock}</div> : null}

        {partialFailuresBlock ? <div className="px-6 pt-4">{partialFailuresBlock}</div> : null}

        {/* Diff Content */}
        <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">{diffList}</div>

        <DialogFooter className="p-4 bg-secondary border-t border-black flex-row justify-between gap-3">
          {footerButtons}
>>>>>>> origin/main
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegenerateDiffPreview;
