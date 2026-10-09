"""Read a public FC endpoint using Python's standard HTTP client.

Compatibility headers documented by 1erkandogan/fc27-clubs-api (_http.py).
No cookies, credentials, added proxies, TLS verification changes, or third-party code.
"""
import html
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ALLOWED = {'clubs/matches', 'clubs/overallStats', 'members/stats', 'allTimeLeaderboard/search', 'currentSeasonLeaderboard/search', 'clubs/info', 'members/career/stats', 'club/playoffAchievements'}
HEADERS = {
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-CH-UA': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
}

def request_json(path, minimal=False):
    parsed = urllib.parse.urlsplit(path)
    if parsed.scheme or parsed.netloc or parsed.fragment or parsed.path not in ALLOWED:
        raise ValueError('Unsupported EA endpoint')
    request = urllib.request.Request('https://proclubs.ea.com/api/fc/' + path,
                                     headers={'Accept': 'application/json'} if minimal else HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read(4 * 1024 * 1024 + 1)
            if len(raw) > 4 * 1024 * 1024:
                raise ValueError('EA response too large')
            return json.loads(raw)
    except urllib.error.HTTPError as error:
        # Never print response cookies, credentials or full error pages.
        body = html.unescape(error.read(4096).decode('utf-8', errors='replace'))
        reference = re.search(r'Reference\s*#([\w.\-]+)', body)
        detail = ' reference=' + reference.group(1) if reference else ''
        raise RuntimeError(f'EA {parsed.path}: HTTP {error.code}{detail}') from None

def main():
    try:
        if len(sys.argv) < 2:
            raise ValueError('EA endpoint is required')
        result = request_json(sys.argv[1], '--minimal' in sys.argv[2:])
        print(json.dumps(result, separators=(',', ':')))
    except (OSError, ValueError, RuntimeError) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
