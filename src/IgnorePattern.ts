import * as vscode from 'vscode';

export abstract class IgnorePattern {
	match(uri: vscode.Uri) {
		return this.matchString(uri.toString());
	}

	id?: string;

	matchString(_: string) {
		return false;
	}
}

export class IgnoreFile extends IgnorePattern {
	constructor(public uri: vscode.Uri, public folder?: boolean) {
		super();
	}

	matchString(uri: string) {
		if (this.folder && uri.startsWith(this.uri.toString() + '/')) {
			return true;
		}
		return uri === this.uri.toString();
	}
}

export class IgnoreRegex extends IgnorePattern {
	constructor(public regex: RegExp) {
		super();
	}

	matchString(uri: string) {
		return this.regex.test(uri);
	}
}

export class IgnoreExtension extends IgnorePattern {
	constructor(public extension: string) {
		super();
	}

	matchString(uri: string) {
		return uri.endsWith(this.extension);
	}
}
