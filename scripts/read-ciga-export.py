"""Read a public CIGA ZIP in memory; never extract members to disk or execute HTML."""
import io
import json
import re
import sys
import zipfile


def read_export(data):
    if len(data) > 12_000_000:
        raise ValueError('CIGA: ZIP excede 12 MB')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        members = archive.infolist()
        if len(members) != 1 or not re.fullmatch(r'publicacoes_de_\d{4}_\d{2}_\d{2}_\d{4}_\d{4}\.json', members[0].filename):
            raise ValueError('CIGA: ZIP fora do formato JSON público esperado')
        member = members[0]
        if member.file_size > 80_000_000 or member.flag_bits & 1:
            raise ValueError('CIGA: exportação grande demais ou cifrada')
        with archive.open(member) as stream:
            raw = stream.read(80_000_001)
        if len(raw) > 80_000_000:
            raise ValueError('CIGA: expansão excede 80 MB')
        payload = json.loads(raw)
    auto = payload.get('autopublicacoes')
    ordinary = payload.get('edicao_ordinaria')
    if ordinary in (None, [], {}):
        ordinary = {'atos': [], 'data': None}
    if not isinstance(auto, list) or not isinstance(ordinary, dict) or not isinstance(ordinary.get('atos'), list):
        raise ValueError('CIGA: estrutura de atos não reconhecida')
    selected = []
    for rows, inherited_date in [(auto, None), (ordinary['atos'], ordinary.get('data'))]:
        for row in rows:
            if not isinstance(row, dict) or row.get('texto') is not None and not isinstance(row.get('texto'), str):
                raise ValueError('CIGA: ato sem campo texto válido')
            text = row.get('texto') or ''
            if re.search(r'cons[oó]rcio', text + ' ' + str(row.get('titulo', '')), re.IGNORECASE):
                selected.append({**row, 'texto': text, '_edition_date': inherited_date})
    return {'total': len(auto) + len(ordinary['atos']), 'rows': selected}


if __name__ == '__main__':
    try:
        result = read_export(sys.stdin.buffer.read(12_000_001))
        # ASCII escaping also makes the pipe independent of Windows' code page.
        print(json.dumps(result, ensure_ascii=True))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
