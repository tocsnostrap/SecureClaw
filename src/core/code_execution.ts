/**
 * LIVE CODE EXECUTION ENGINE
 * 
 * Execute JavaScript/Python code directly in sandboxed environment
 * Real-time code running - not just generation
 */

import { executeBrowserTask } from '../skills/browser_skill';
import vm from 'vm';

/**
 * EXECUTE JAVASCRIPT - Run code in secure sandbox
 */
export async function executeJavaScript(
  code: string,
  timeout: number = 5000
): Promise<{ success: boolean; output?: any; error?: string; executionTime?: number }> {
  console.log(`[Code Execution] ⚡ Executing JavaScript...`);
  
  const startTime = Date.now();
  
  try {
    // Create sandbox context
    const sandbox = {
      console: {
        log: (...args: any[]) => console.log('[Sandbox]', ...args),
        error: (...args: any[]) => console.error('[Sandbox]', ...args),
      },
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      Math,
      Date,
      JSON,
      Array,
      Object,
      String,
      Number,
      result: undefined,
    };
    
    // Wrap code to capture result
    const wrappedCode = `
      (function() {
        ${code}
        return typeof result !== 'undefined' ? result : 'Code executed successfully';
      })();
    `;
    
    const script = new vm.Script(wrappedCode, {
      filename: 'user_code.js',
      timeout,
    });
    
    const context = vm.createContext(sandbox);
    const output = script.runInContext(context, { timeout });
    
    const executionTime = Date.now() - startTime;
    
    console.log(`[Code Execution] ✅ Executed in ${executionTime}ms`);
    
    return {
      success: true,
      output,
      executionTime,
    };
    
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    
    console.error(`[Code Execution] ❌ Error:`, error.message);
    
    return {
      success: false,
      error: error.message,
      executionTime,
    };
  }
}

/**
 * EXECUTE PYTHON - Run Python code (via browser or subprocess)
 */
export async function executePython(
  code: string
): Promise<{ success: boolean; output?: string; error?: string }> {
  console.log(`[Code Execution] 🐍 Executing Python...`);
  
  try {
    // Use browser-based Python (Pyodide) or subprocess
    const result = await executeBrowserTask(
      'python_execution',
      async (browser, page) => {
        await page.goto('https://pyodide.org/en/stable/console.html');
        
        // Wait for Pyodide to load
        await page.waitForFunction(() => (window as any).pyodide !== undefined, { timeout: 30000 });
        
        // Execute code
        const output = await page.evaluate(async (pythonCode) => {
          const pyodide = (window as any).pyodide;
          try {
            const result = await pyodide.runPythonAsync(pythonCode);
            return { success: true, output: String(result) };
          } catch (err: any) {
            return { success: false, error: err.message };
          }
        }, code);
        
        return output;
      },
      {}
    );
    
    if (result.success) {
      return result.data;
    }
    
    return {
      success: false,
      error: result.message,
    };
    
  } catch (error: any) {
    console.error(`[Code Execution] ❌ Python error:`, error.message);
    
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * RUN CODE WITH AUTO-DEPENDENCIES - AI figures out what libraries are needed
 */
export async function runCodeWithAutoDeps(
  code: string,
  language: 'javascript' | 'python'
): Promise<any> {
  console.log(`[Code Execution] 🔧 Auto-detecting dependencies...`);
  
  // Use AI to analyze code and determine required imports
  const analysisPrompt = `Analyze this ${language} code and list required imports/libraries:

\`\`\`${language}
${code}
\`\`\`

List required packages/imports as JSON array: ["package1", "package2"]`;

  try {
    const analysis = await callGrok([
      { role: 'system', content: 'You are analyzing code dependencies.' },
      { role: 'user', content: analysisPrompt },
    ]);
    
    const jsonMatch = analysis.match(/\[[\s\S]*?\]/);
    const deps = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    
    console.log(`[Code Execution] 📦 Dependencies: ${deps.join(', ')}`);
    
    // Execute based on language
    if (language === 'javascript') {
      return await executeJavaScript(code);
    } else {
      return await executePython(code);
    }
    
  } catch (error: any) {
    console.error(`[Code Execution] ❌ Auto-deps error:`, error.message);
    
    // Try executing anyway
    return language === 'javascript' ? 
      await executeJavaScript(code) : 
      await executePython(code);
  }
}

export default {
  executeJavaScript,
  executePython,
  runCodeWithAutoDeps,
};
