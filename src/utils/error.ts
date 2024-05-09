import * as vscode from 'vscode';
import { ErrorToast } from '../features/models';

export const printError = (error: ErrorToast) => {
    if (error.warning) {
        vscode.window.showWarningMessage(error.type);
    } else {
        vscode.window.showErrorMessage(error.type);
    }
};
