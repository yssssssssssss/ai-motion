import type { MotionComponent, MotionPatch } from "@motion-tool/core";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isComponent(value: unknown): value is MotionComponent {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    isRecord(value.source) &&
    Array.isArray(value.source.files) &&
    typeof value.source.entry === "string" &&
    isRecord(value.manifest) &&
    Array.isArray(value.manifest.params)
  );
}

function isDraft(value: unknown): value is { componentId: string; patch: MotionPatch } {
  return (
    isRecord(value) &&
    typeof value.componentId === "string" &&
    isRecord(value.patch) &&
    typeof value.patch.id === "string" &&
    typeof value.patch.sourceManifestId === "string" &&
    isRecord(value.patch.values)
  );
}

export function createComponentStore(name = "ai-motion-web") {
  let database: Promise<IDBDatabase> | undefined;

  function open(): Promise<IDBDatabase> {
    if (database) return database;
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("components", { keyPath: "id" });
        request.result.createObjectStore("drafts", { keyPath: "componentId" });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          database = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("本地存储被占用"));
    }).catch((error: unknown) => {
      database = undefined;
      throw error;
    });
    return database;
  }

  async function transaction<T>(
    stores: string[],
    mode: IDBTransactionMode,
    action: (tx: IDBTransaction) => IDBRequest<T>
  ): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      const request = action(tx);
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error ?? new Error("本地存储事务失败"));
      tx.onerror = () => reject(tx.error ?? request.error);
    });
  }

  return {
    async load() {
      const [components, drafts] = await Promise.all([
        transaction<unknown[]>(["components"], "readonly", (tx) => tx.objectStore("components").getAll()),
        transaction<unknown[]>(["drafts"], "readonly", (tx) => tx.objectStore("drafts").getAll())
      ]);
      return {
        components: components.filter(isComponent),
        drafts: Object.fromEntries(drafts.filter(isDraft).map((draft) => [draft.componentId, draft.patch]))
      };
    },
    async saveComponent(component: MotionComponent) {
      await transaction(["components"], "readwrite", (tx) => tx.objectStore("components").put(component));
    },
    async saveDraft(componentId: string, patch: MotionPatch) {
      if (Object.keys(patch.values).length === 0) {
        await transaction(["drafts"], "readwrite", (tx) => tx.objectStore("drafts").delete(componentId));
        return;
      }
      await transaction(["drafts"], "readwrite", (tx) =>
        tx.objectStore("drafts").put({ componentId, patch })
      );
    },
    async deleteComponent(componentId: string) {
      await transaction(["components", "drafts"], "readwrite", (tx) => {
        tx.objectStore("drafts").delete(componentId);
        return tx.objectStore("components").delete(componentId);
      });
    }
  };
}
