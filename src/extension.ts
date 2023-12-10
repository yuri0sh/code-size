import * as vscode from 'vscode';
import { FileSizeTreeItem, FileSizeTreeDataProvider } from './FileSizeTreeProvider';
import { RegexFilterRule, FileFilterRule, ExtensionFilterRule } from './FilterRule';

// TODO: add optional file type grouping
export function activate(context: vscode.ExtensionContext) {
	const treeDataProvider = new FileSizeTreeDataProvider();

	let treeView = vscode.window.createTreeView('size.sizeTree', { treeDataProvider, canSelectMany: true });
	
	treeView.onDidChangeCheckboxState(treeDataProvider.onDidChangeCheckboxState.bind(treeDataProvider));
	treeView.description = 'Explorer';

	let worspaceListener = vscode.workspace.onDidChangeWorkspaceFolders( () => treeDataProvider.refresh(true));
	let refresh = vscode.commands.registerCommand('size.refreshTree', () => treeDataProvider.refresh(true));

	let modeFiles = vscode.commands.registerCommand('size.modeFiles', () => {
		vscode.commands.executeCommand('setContext', 'size.treeType', 'file');
		treeDataProvider.branchBy = 'file';
		treeDataProvider.refresh(false);
	});

	let modeExtensions = vscode.commands.registerCommand('size.modeExtensions', () => {
		vscode.commands.executeCommand('setContext', 'size.treeType', 'extension');
		treeDataProvider.branchBy = 'extension';
		treeDataProvider.refresh(false);
	});

	let modeFolders = vscode.commands.registerCommand('size.modeFolders', () => {
		vscode.commands.executeCommand('setContext', 'size.treeType', 'folder');
		
		// let uri = vscode.window.activeTextEditor?.document.uri;

		// // TODO: outline size view
		// vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri).then(el => {
		// 	let arr = el as vscode.SymbolInformation[] | vscode.DocumentSymbol[];

		// 	let r = el as any[];
			
		// 	vscode.window.showInformationMessage(JSON.stringify(el));
		// });


		treeDataProvider.branchBy = 'folder';
		treeDataProvider.refresh(false);
	});

	let enableGitihnoreCommand = vscode.commands.registerCommand('size.enableGitignore', () => {
		// TODO: optimize so that gitignore doesnt refetch file sizes when enabled
		vscode.commands.executeCommand('setContext', 'size.gitignoreEnabled', true);
		treeDataProvider.handleGitignoreConfig = true;
		treeDataProvider.refresh(true);
	});

	let setTreeTypeCommand = vscode.commands.registerCommand('size.setTreeType', () => {
		vscode.window.showQuickPick(['Files', 'Folders', 'File Extensions']).then( (e) => {
			if (e === 'Files') {
				vscode.commands.executeCommand('size.modeFiles');
			} else if (e === 'Folders') {
				vscode.commands.executeCommand('size.modeFolders');
			} else if (e === 'File Extensions') {
				vscode.commands.executeCommand('size.modeExtensions');
			}
		});
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

	let toggleFilterMode = vscode.commands.registerCommand('size.toggleFilterMode', () => {
		treeDataProvider.filterPass = !treeDataProvider.filterPass;
		treeDataProvider.refresh(false);
	});

	vscode.commands.registerCommand('size.ignorePath',  async (item: FileSizeTreeItem) => {
		if (item?.contextValue === 'extRoot') {
			if (!item.resourceUri) {return;}
			treeDataProvider.addFilterRule(new ExtensionFilterRule(item.resourceUri.path.replace('/', '')));
			return;
		}

		if (!item?.contextValue && item?.resourceUri) {
			treeDataProvider.addFilterRule(new FileFilterRule(item.resourceUri, item.folder));
			return;
		}


		let value = await vscode.window.showInputBox({
			title: 'Size: Add Filter Rule',
			placeHolder: 'Enter a regex pattern to filter',
			validateInput: (value) => {
				try {
					new RegExp(value);
					return null;
				} catch (e: any) {
					return e?.message;
				}
			}
		});

		if (!value) {return;}

		treeDataProvider.addFilterRule(new RegexFilterRule(new RegExp(value)));

		return;
	});

	vscode.commands.registerCommand('size.includePath', async (item: any) => {
		if (!item) {
			const includeAll = {label: "Remove All", filterRule: null};

			let ruleItems = treeDataProvider.filterRules.map(treeDataProvider.filterRuleToTreeItem.bind(treeDataProvider));
			ruleItems.forEach((e) => e.description = e.description + (e.filterRule.enabled ? '' : ' (Disabled)'));

			if (ruleItems.length === 0) {
				vscode.window.showInformationMessage('No filters set, nothing to remove');
				return;
			}

			let value = await vscode.window.showQuickPick(ruleItems, 
				{canPickMany: true, placeHolder: 'Select filters to remove'});

			if (!value) {return;}

			for (let rule of value) {
				treeDataProvider.removeFilterRule(rule.filterRule);
			}

			return;
		}

		if (item.contextValue === 'ignoreRoot') {
			treeDataProvider.resetFilters();
		} else {
			treeDataProvider.removeFilterRule(item?.filterRule);
		}
	});

	vscode.commands.executeCommand('setContext', 'size.treeType', treeDataProvider.branchBy);
	vscode.commands.executeCommand('setContext', 'size.gitignoreEnabled', true);

	context.subscriptions.push(treeView);
	context.subscriptions.push(refresh);
	context.subscriptions.push(worspaceListener);
	context.subscriptions.push(configListener);
	context.subscriptions.push(modeFiles);
	context.subscriptions.push(modeFolders);
}

export function deactivate() {}
