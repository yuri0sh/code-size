import * as vscode from 'vscode';

export abstract class FilterRule {
	match(uri: vscode.Uri) {
		return this.matchString(uri.toString());
	}

	enabled = true;
	id?: string;

	matchString(_: string) {
		return false;
	}
}

export class FileFilterRule extends FilterRule {
	constructor(public uri: vscode.Uri, public folder?: boolean) {
		super();
		this.id = uri.toString() + '+fs';
	}

	matchString(uri: string) {
		if (this.folder && uri.startsWith(this.uri.toString() + '/')) {
			return true;
		}
		return uri === this.uri.toString();
	}
}

export class RegexFilterRule extends FilterRule {
	constructor(public regex: RegExp) {
		super();
		this.id = regex.toString() + '+re';
	}

	matchString(uri: string) {
		return this.regex.test(uri);
	}
}

export class ExtensionFilterRule extends FilterRule {
	constructor(public fileExtension: string) {
		super();
		this.id = fileExtension + '+ext';
	}

	matchString(uri: string) {
		return uri.endsWith(this.fileExtension);
	}
}
