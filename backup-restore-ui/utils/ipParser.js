function parseIPData(text) {
  const lines = text.trim().split('\n');
  const groups = [];
  let currentGroup = null;

  for (const line of lines) {
    if (line.startsWith('# ')) {
      const groupName = line.replace('# ', '').trim();
      currentGroup = { group: groupName, entries: [] };
      groups.push(currentGroup);
    } else if (line.startsWith('###')) {
      const parts = line.replace('###', '').trim().split(/\s+/);
      const name = parts[0];
      const ip = parts.find(p => /^\d{1,3}(\.\d{1,3}){3}$/.test(p));
      currentGroup?.entries.push({ name, ip, status: 'UNKNOWN' });
    }
  }

  return groups;
}

module.exports = parseIPData;
