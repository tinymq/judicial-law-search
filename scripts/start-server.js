const { spawn } = require('child_process');
const path = require('path');

const cwd = path.resolve(__dirname, '..');

const child = spawn('npm', ['run', 'start'], {
  cwd: cwd,
  stdio: 'inherit',
  shell: true
});

child.on('error', (error) => {
  console.error('启动失败:', error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (code) {
    console.log(`进程退出，代码: ${code}`);
  } else if (signal) {
    console.log(`进程被信号杀死: ${signal}`);
  }
});
