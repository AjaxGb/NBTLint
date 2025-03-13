import sys
import os
from io import TextIOWrapper
from urllib.request import urlopen
from bisect import bisect_left
import shutil

# Generate data table of Unicode codepoint names that matches
# the behavior of Java's `Character.getName(int)`.
#
# Format is three blocks, separated by blank lines:
# - Unicode version (single line)
# - <first codepoint>;<last codepoint>;<range name>
# - <codepoint>;<name>
#
# If a codepoint has an entry in the last block,
#   use that name verbatim.
# If it falls within one of the ranges in the middle block,
#   use that name + ' ' + the upper hex of the codepoint.
# Otherwise, the character has no name.

class RangeDict:
    def __init__(self):
        self._entries = []

    def append(self, lo, hi, value):
        if lo > hi:
            raise ValueError(f'{lo}..{hi} has negative size')
        if self._entries and self._entries[-1][1] >= lo:
            old_lo, old_hi, _ = self._entries[-1]
            raise ValueError(f'{lo}..{hi} does not follow the previous range {old_lo:X}..{old_hi:X}')
        self._entries.append((lo, hi, value))

    def get(self, k, default=None):
        idx = bisect_left(self._entries, k, key=lambda e: e[1])
        if idx < len(self._entries) and k >= self._entries[idx][0]:
            return self._entries[idx][2]
        return default

    def __getitem__(self, i):
        return self._entries[i]

    def __len__(self):
        return len(self._entries)

def body_lines(resp):
    for line in TextIOWrapper(resp, encoding='utf-8'):
        line = line.removesuffix('\n')
        if line and not line.startswith('#'):
            yield line

def parse_codepoint(txt):
    return int(txt, 16)

def resolve_range_name(cp, range_names):
    block_name = range_names.get(cp)
    if block_name is None:
        return None
    return f'{block_name} {cp:X}'

def get_full_blocks(unicode_version):
    full_blocks = RangeDict()
    with urlopen(f'https://www.unicode.org/Public/{unicode_version}/ucd/Blocks.txt') as resp:
        for line in body_lines(resp):
            codepoints, name = line.split('; ')
            lo, hi = map(parse_codepoint, codepoints.split('..'))
            name = name.upper().replace('-', ' ')
            full_blocks.append(lo, hi, name)
    return full_blocks

def get_names(unicode_version):
    full_blocks = get_full_blocks(unicode_version)

    cp_names = {}
    range_names = RangeDict()
    with urlopen(f'https://www.unicode.org/Public/{unicode_version}/ucd/UnicodeData.txt') as resp:
        open_range_start = None
        open_range_name = None
        for line in body_lines(resp):
            line = line.split(';')
            cp = parse_codepoint(line[0])
            name = line[1]
            old_name = line[10]

            # Logic copied from https://github.com/openjdk/jdk/blob/jdk-21%2B0/make/jdk/src/classes/build/tools/generatecharacter/CharacterName.java
            if name == '<control>':
                if cp == 0x07:
                    name = 'BEL'
                elif old_name:
                    name = old_name
                elif cp == 0x80:
                    name = 'PADDING CHARACTER'
                elif cp == 0x81:
                    name = 'HIGH OCTET PRESET'
                elif cp == 0x99:
                    name = 'SINGLE GRAPHIC CHARACTER INTRODUCER'
                else:
                    name = resolve_range_name(cp, full_blocks)
            elif name.startswith('<'):
                if name.endswith(', First>'):
                    # Start of block-named range
                    name = name[1:-len(', First>')]
                    if open_range_start is not None:
                        raise ValueError(f'Multiple ranges open at once ({open_range_name!r}, {name!r})')
                    open_range_name = name
                    open_range_start = cp
                elif name.endswith(', Last>'):
                    # End of block-named range
                    name = name[1:-len(', Last>')]
                    if open_range_name != name:
                        raise ValueError(f'Mismatched closing range ({open_range_name!r}, {name!r})')
                    block_name = full_blocks.get(open_range_start)
                    if block_name is None or block_name != full_blocks.get(cp):
                        raise ValueError(f'Codepoint range {name!r} does not fit inside a single block')
                    range_names.append(open_range_start, cp, block_name)
                    open_range_name = open_range_start = None
                else:
                    raise ValueError(f'Unrecognized special codepoint name {name!r}')
                continue
            if not name:
                raise ValueError(f'Codepoint {cp:X} has no name')
            cp_names[cp] = name
    return cp_names, range_names

if __name__ == '__main__':
    if sys.version_info < (3, 10):
        sys.exit(f'Requires Python 3.10+')
    unicode_version = '15.0.0'
    if len(sys.argv) == 2:
        unicode_version = sys.argv[1].strip()
    elif len(sys.argv) > 2:
        sys.exit(f'Usage: {sys.argv[0]} [<unicode version>]')

    print('Fetching data... ', end='', flush=True)
    cp_names, range_names = get_names(unicode_version)
    print('done.', flush=True)

    print('Cleaning dir... ', end='', flush=True)
    shutil.rmtree('docs/unicode/cp', ignore_errors=True)
    os.makedirs('docs/unicode/cp', exist_ok=True)
    for f in os.scandir('docs/unicode'):
        if not f.name == 'cp':
            os.remove(f.path)
    print('done.', flush=True)

    total = str(len(cp_names))
    print(f'Writing explicit codepoints...')
    letter_dirs = set()
    for i, (cp, name) in enumerate(cp_names.items(), 1):
        # if not re.fullmatch(r'[A-Z0-9 -]+', name):
        #     print('Skipping', name, 'due to special characters')
        #     continue
        print(f'{i:0{len(total)}}/{total}', end='\r', flush=True)
        path = f'docs/unicode/cp/{name[0]}'
        if name[0] not in letter_dirs:
            os.mkdir(path)
            letter_dirs.add(name[0])
        with open(f'{path}/{name[1:]}.txt', 'w', encoding='ascii') as out:
            print(f'{cp:X}', end='', file=out)
    print(f' {'':{2*len(total)}}', end='\r')
    total = str(len(range_names))
    with open(f'docs/unicode/ranges.txt', 'w', encoding='ascii', newline='\n') as out:
        for i, (lo, hi, name) in enumerate(range_names, 1):
            print(f'{name};{lo:X};{hi:X}', file=out)
    with open(f'docs/unicode/version.txt', 'w', encoding='ascii') as out:
        print(unicode_version, end='', file=out)
    print(f'Done.{'':{2*len(total)}}')
