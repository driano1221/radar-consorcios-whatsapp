import {spawn} from 'node:child_process';
import {isolatedTestEnvironment} from './isolated-environment.mjs';

console.log('[testes] Processo isolado: envio, persistência e IA desligados; credenciais de envio removidas.');
const child=spawn(process.execPath,['--test',...process.argv.slice(2)],{
  stdio:'inherit',env:isolatedTestEnvironment(),windowsHide:true,
});
child.on('error',error=>{console.error('Não foi possível iniciar os testes:',error.message);process.exitCode=1;});
child.on('exit',(code,signal)=>{process.exitCode=signal?1:code??1;});
