const { spawn } = require('child_process');
const path = require('path');

const cwd = path.resolve(__dirname, '..');
const nextBin = require.resolve('next/dist/bin/next');
const port = process.env.PORT || '3000';

const child = spawn(process.execPath, [nextBin, 'start', '-H', '0.0.0.0', '-p', port], {
  cwd,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: port,
  },
});

child.on('error', (error) => {
  console.error('启动失败:', error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (typeof code === 'number') {
    process.exit(code);
  }

  if (signal) {
    console.log(`进程被信号杀死: ${signal}`);
  }

  process.exit(1);
});
