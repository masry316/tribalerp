import {
  runTacticalAutoSearch,
  runTacticalSimulation,
  type ErpAppState,
  type TacticalAutoSearchResult,
  type TacticalSimulationResult,
  type TacticalStrategyPolicy,
  type TacticalStudioInput
} from '../core';

export type TacticalWorkerRequest =
  | {
      id: number;
      kind: 'simulate';
      input: TacticalStudioInput;
      state: ErpAppState;
      policy: TacticalStrategyPolicy | null;
    }
  | {
      id: number;
      kind: 'autoSearch';
      input: TacticalStudioInput;
      state: ErpAppState;
    };

export type TacticalWorkerResponse =
  | {
      id: number;
      kind: 'simulate';
      ok: true;
      result: TacticalSimulationResult;
    }
  | {
      id: number;
      kind: 'autoSearch';
      ok: true;
      result: TacticalAutoSearchResult;
    }
  | {
      id: number;
      kind: 'simulate' | 'autoSearch';
      ok: false;
      error: string;
    };

self.onmessage = (event: MessageEvent<TacticalWorkerRequest>) => {
  const req = event.data;
  try {
    if (req.kind === 'simulate') {
      const result = runTacticalSimulation(req.input, req.state, req.policy);
      const response: TacticalWorkerResponse = {
        id: req.id,
        kind: 'simulate',
        ok: true,
        result
      };
      self.postMessage(response);
      return;
    }

    if (req.kind === 'autoSearch') {
      const result = runTacticalAutoSearch(req.input, req.state);
      const response: TacticalWorkerResponse = {
        id: req.id,
        kind: 'autoSearch',
        ok: true,
        result
      };
      self.postMessage(response);
    }
  } catch (err) {
    const response: TacticalWorkerResponse = {
      id: req.id,
      kind: req.kind,
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    };
    self.postMessage(response);
  }
};
