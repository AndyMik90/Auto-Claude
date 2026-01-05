import path from 'path';
import { getAugmentedEnv } from './env-utils';
import { getToolPath } from './cli-tool-manager';

export type ClaudeCliInvocation = {
  command: string;
  env: Record<string, string>;
};

function ensureCommandDirInPath(command: string, env: Record<string, string>): Record<string, string> {
  if (!path.isAbsolute(command)) {
    return env;
  }

  const pathSeparator = process.platform === 'win32' ? ';' : ':';
  const commandDir = path.dirname(command);
  const currentPath = env.PATH || '';
  const pathEntries = currentPath.split(pathSeparator);

  if (pathEntries.includes(commandDir)) {
    return env;
  }

  return {
    ...env,
    PATH: [commandDir, currentPath].filter(Boolean).join(pathSeparator),
  };
}

export function getClaudeCliInvocation(): ClaudeCliInvocation {
  const command = getToolPath('claude');
  const env = getAugmentedEnv();

  return {
    command,
    env: ensureCommandDirInPath(command, env),
  };
}
