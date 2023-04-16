import * as vscode from 'vscode';
import { OpenAIRepository } from '../repository/openai-repository';
import {extractDartCode, extractExplanation} from '../utilities/code-processing';

export async function debugErrors(openAIRepo: OpenAIRepository, errorType: 'runtime' | 'compile-time' = 'runtime') {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const selectedCode = editor.document.getText(editor.selection);
    if (!selectedCode) {
        vscode.window.showErrorMessage('No code selected');
        return;
    }

    let errorsDescription: string | undefined;

    if (errorType === 'runtime') {
        errorsDescription = await vscode.window.showInputBox({ prompt: "Enter the errors you're facing" });
        if (!errorsDescription) {
            return;
        }
    } else if (errorType === 'compile-time') {
        //TODO: implement compile-time errors
        // const analysisErrors = await analyzeCode(selectedCode);
        // if (analysisErrors.length === 0) {
        //     vscode.window.showInformationMessage('No compile-time issues found');
        //     return;
        // }
        // errorsDescription = analysisErrors.map(error => error.message).join('\n');
    }

    const fullCode = editor.document.getText();

    try {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Debugging Errors",
            cancellable: false
        }, async (progress) => {
            let progressPercentage = 0;
            let prevProgressPercentage = 0;
            const progressInterval = setInterval(() => {
                prevProgressPercentage = progressPercentage;
                progressPercentage = (progressPercentage + 10) % 100;
                const increment = progressPercentage - prevProgressPercentage;
                progress.report({ increment });
            }, 200);

            let promptContent = `Follow the instructoins carefully and to the letter. You're a Flutter/Dart debugging expert. You first mention the possible explanation of the error and then output the fixing code in a single code block.`;
            promptContent += `\n\nHere's a piece of Flutter code with ${errorType} errors:\n\n${selectedCode}\n\n`;
            if (errorsDescription) {
                promptContent += `The errors are: ${errorsDescription}\n\n`;
            } else {
                promptContent += `The full code context is:\n\n${fullCode}\n\n`;
            }

            promptContent += `Please fix the code.`;

            const result = await openAIRepo.getCompletion([ {
                'role': 'user',
                'content': promptContent
            }]);
            clearInterval(progressInterval);
            progress.report({ increment: 100 });

            const fixedCode = extractDartCode(result);
            const explanation = extractExplanation(result);
            editor.edit((editBuilder) => {
                editBuilder.replace(editor.selection, fixedCode);
            });
            vscode.window.showInformationMessage(explanation);
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to fix code: ${error}`);
    }
}