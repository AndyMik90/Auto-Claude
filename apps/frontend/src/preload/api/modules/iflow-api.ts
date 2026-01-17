import { IPC_CHANNELS } from '../../../shared/constants';
import type { IFlowSyncStatus, IFlowModel, IFlowConfig, IPCResult } from '../../../shared/types';
import { invokeIpc } from './ipc-utils';

/**
 * iFlow Integration API operations
 */
export interface IFlowAPI {
  // Connection testing
  testIFlowConnection: (projectId: string, config: IFlowConfig) => Promise<IPCResult<IFlowSyncStatus>>;

  // Model discovery
  discoverIFlowModels: (projectId: string, config: IFlowConfig) => Promise<IPCResult<IFlowModel[]>>;
}

/**
 * Creates the iFlow Integration API implementation
 */
export const createIFlowAPI = (): IFlowAPI => ({
  testIFlowConnection: (projectId: string, config: IFlowConfig): Promise<IPCResult<IFlowSyncStatus>> =>
    invokeIpc(IPC_CHANNELS.IFLOW_TEST_CONNECTION, projectId, config),

  discoverIFlowModels: (projectId: string, config: IFlowConfig): Promise<IPCResult<IFlowModel[]>> =>
    invokeIpc(IPC_CHANNELS.IFLOW_DISCOVER_MODELS, projectId, config),
});
