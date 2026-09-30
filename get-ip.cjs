const os = require('os');

function getPrimaryIp() {
  const nets = os.networkInterfaces();
  const list = [];
  for (const [name, arr] of Object.entries(nets)) {
    for (const n of arr || []) {
      if (n.family === 'IPv4' && !n.internal && !n.address.startsWith('169.254')) {
        list.push({ name, ip: n.address });
      }
    }
  }
  list.sort((a, b) => {
    const isVirtA = /vmware|virtual|vbox|wsl/i.test(a.name);
    const isVirtB = /vmware|virtual|vbox|wsl/i.test(b.name);
    if (isVirtA !== isVirtB) return isVirtA ? 1 : -1;
    const isPriA = /wi-?fi|ethernet|lan/i.test(a.name);
    const isPriB = /wi-?fi|ethernet|lan/i.test(b.name);
    if (isPriA !== isPriB) return isPriA ? -1 : 1;
    return 0;
  });
  return list[0]?.ip || 'localhost';
}

console.log(getPrimaryIp());
