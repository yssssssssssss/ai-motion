import type { MotionSkillElement } from "@motion-tool/core";
import type { WheelEvent } from "react";

type Props = {
  elements: MotionSkillElement[];
  selectedElementId: string;
  selectedVariant: string;
  onSelectElement: (elementId: string) => void;
  onSelectVariant: (variant: string) => void;
};

function selectedElement(elements: MotionSkillElement[], id: string): MotionSkillElement | null {
  return elements.find((element) => element.id === id) ?? elements[0] ?? null;
}

function handleElementWheel(event: WheelEvent<HTMLDivElement>) {
  const elementList = event.currentTarget;
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

  const maxScrollLeft = elementList.scrollWidth - elementList.clientWidth;
  if (maxScrollLeft <= 0) return;

  const nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, elementList.scrollLeft + event.deltaY));
  if (nextScrollLeft === elementList.scrollLeft) return;

  event.preventDefault();
  elementList.scrollLeft = nextScrollLeft;
}

export function AtomicMotionPanel({
  elements,
  selectedElementId,
  selectedVariant,
  onSelectElement,
  onSelectVariant
}: Props) {
  const current = selectedElement(elements, selectedElementId);
  const variants = current?.variants ?? [];

  return (
    <section className="atomic-motion-panel" aria-label="原子动效配置">
      <div className="atomic-motion-content">
        <div className="atomic-motion-column">
          <p className="atomic-motion-label">元素</p>
          <div
            className="atomic-motion-element-grid"
            aria-label="元素横向卡片列表"
            role="list"
            onWheel={handleElementWheel}
          >
            {elements.map((element) => {
              const isSelected = element.id === current?.id;
              return (
                <div
                  className={
                    isSelected ? "atomic-motion-element-card is-expanded" : "atomic-motion-element-card"
                  }
                  key={element.id}
                  role="listitem"
                >
                  <button
                    className={isSelected ? "atomic-motion-option is-on" : "atomic-motion-option"}
                    type="button"
                    disabled={!element.active}
                    onClick={() => onSelectElement(element.id)}
                  >
                    <span>{element.label}</span>
                    <small>{element.active ? `v${element.latestVersion}` : "暂不可用"}</small>
                  </button>
                  {isSelected ? (
                    <div className="atomic-motion-variant-tray" aria-label="梯度">
                      {variants.length > 0 ? (
                        variants.map((variant) => (
                          <button
                            className={
                              variant === selectedVariant
                                ? "atomic-motion-variant-pill is-on"
                                : "atomic-motion-variant-pill"
                            }
                            type="button"
                            disabled={!current?.active}
                            onClick={() => onSelectVariant(variant)}
                            key={variant}
                          >
                            {variant}
                          </button>
                        ))
                      ) : (
                        <span className="atomic-motion-empty">暂无可用梯度</span>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
