import type { MotionSkillElement } from "@motion-tool/core";

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
      <header className="atomic-motion-header">
        <div>
          <p className="eyebrow">Designer CSV</p>
          <h2 id="atomic-motion-title">原子动效参数</h2>
        </div>
      </header>

      <div className="atomic-motion-content">
        <div className="atomic-motion-column">
          <p className="atomic-motion-label">元素</p>
          <div className="atomic-motion-element-grid" aria-label="元素">
            {elements.map((element) => {
              const isSelected = element.id === current?.id;
              return (
                <div
                  className={isSelected ? "atomic-motion-element-card is-expanded" : "atomic-motion-element-card"}
                  key={element.id}
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
