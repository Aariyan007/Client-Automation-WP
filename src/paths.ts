import os from 'node:os';
import path from 'node:path';

export const homeDir = () => process.env.CLIENT_AUTO_HOME ?? path.join(os.homedir(), '.client-auto');
export const registryFile = () => path.join(homeDir(), 'projects.json');
export const credentialsFile = () => path.join(homeDir(), 'credentials.json');
export const projectDir = (folder: string) => path.join(folder, '.client-auto');
export const configFile = (folder: string) => path.join(projectDir(folder), 'config.json');
export const logFile = (folder: string) => path.join(projectDir(folder), 'log.md');
export const stateFile = (folder: string) => path.join(projectDir(folder), 'state.json');
