import * as vscode from 'vscode';
import { FileSizeTreeDataProvider } from './FileSizeTreeProvider';

// TODO: add optional file type grouping
export function activate(context: vscode.ExtensionContext) {
	const treeDataProvider = new FileSizeTreeDataProvider();

	let treeView = vscode.window.createTreeView('size.sizeTree', { treeDataProvider });

	let worspaceListener = vscode.workspace.onDidChangeWorkspaceFolders( () => treeDataProvider.refresh(true));
	let refresh = vscode.commands.registerCommand('size.refreshTree', () => treeDataProvider.refresh(true));

	let modeFiles = vscode.commands.registerCommand('size.modeFiles', () => {
		vscode.commands.executeCommand('setContext', 'size.fileView', true);
		treeDataProvider.fileViewConfig = true;
		treeDataProvider.refresh(false);
	});

	let modeFolders = vscode.commands.registerCommand('size.modeFolders', () => {
		vscode.commands.executeCommand('setContext', 'size.fileView', false);
		treeDataProvider.fileView = false;
		treeDataProvider.refresh(false);
	});

	let enableGitihnoreCommand = vscode.commands.registerCommand('size.enableGitignore', () => {
		// TODO: optimize so that gitignore doesnt refetch file sizes when enabled
		vscode.commands.executeCommand('setContext', 'size.gitignoreEnabled', true);
		treeDataProvider.handleGitignoreConfig = true;
		treeDataProvider.refresh(true);
	});

	let disableGitihnoreCommand = vscode.commands.registerCommand('size.disableGitignore', () => {
		vscode.commands.executeCommand('setContext', 'size.gitignoreEnabled', false);
		treeDataProvider.handleGitignoreConfig = false;
		treeDataProvider.refresh(true);
	});

	let configListener = vscode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration('size')) {
			treeDataProvider.refresh(false);
		}
	});

	let settingsCommand = vscode.commands.registerCommand('size.openSettings', () => {
		vscode.commands.executeCommand('workbench.action.openSettings', '@ext:yurish.size');
	});

	vscode.commands.executeCommand('setContext', 'size.fileView', false);
	vscode.commands.executeCommand('setContext', 'size.gitignoreEnabled', true);



	context.subscriptions.push(treeView);
	context.subscriptions.push(refresh);
	context.subscriptions.push(worspaceListener);
	context.subscriptions.push(configListener);
	context.subscriptions.push(modeFiles);
	context.subscriptions.push(modeFolders);
}

export function deactivate() {}
