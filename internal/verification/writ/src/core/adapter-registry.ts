export interface ExactContractAdapter<TInput = unknown, TOutput = unknown> {
  contractId: string;
  declaredVersion: string;
  adapt(input: TInput): TOutput;
}

function adapterKey(contractId: string, declaredVersion: string): string {
  return `${contractId}\0${declaredVersion}`;
}

/**
 * Capability registry for exact contract adapters.
 *
 * The registry says which contract/version pairs this harness can process. It
 * does not define which contracts Writ may create and does not infer version
 * compatibility.
 */
export class ExactContractAdapterRegistry<TInput = unknown, TOutput = unknown> {
  readonly #adapters = new Map<string, ExactContractAdapter<TInput, TOutput>>();

  constructor(adapters: readonly ExactContractAdapter<TInput, TOutput>[] = []) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter: ExactContractAdapter<TInput, TOutput>): void {
    const key = adapterKey(adapter.contractId, adapter.declaredVersion);
    if (this.#adapters.has(key)) {
      throw new Error(
        `Duplicate exact adapter for ${adapter.contractId} at ${adapter.declaredVersion}`,
      );
    }
    this.#adapters.set(key, adapter);
  }

  resolve(
    contractId: string,
    declaredVersion: string,
  ): ExactContractAdapter<TInput, TOutput> | undefined {
    return this.#adapters.get(adapterKey(contractId, declaredVersion));
  }
}
