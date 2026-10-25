"""Generate wholly fictional BIFF8 fixtures with xlwt 1.3.0 (test tooling only)."""

from pathlib import Path

import xlwt

ROOT = Path(__file__).parent
HEADERS = ["日期", "航空公司", "航班号", "出发城市", "出发时间", "到达城市", "到达时间", "里程数", "客票号", "客票状态"]
FLIGHT = ["2024年2月12日", "中国国际航空", "CA1031", "北京首都", "10:00", "广州白云", "13:20", "0", "9990000000001", "已使用"]


def row(**changes):
    result = FLIGHT.copy()
    for column, value in changes.items():
        result[HEADERS.index(column)] = value
    return result


def save(name, sheets):
    book = xlwt.Workbook()
    for title, rows in sheets:
        sheet = book.add_sheet(title)
        for r, values in enumerate(rows):
            for c, value in enumerate(values):
                sheet.write(r, c, value)
    book.save(str(ROOT / name))


save("standard.xls", [("已结束", [HEADERS, FLIGHT])])
save("review.xls", [
    ("OPEN票 99", [HEADERS, row(日期="日期待定", 出发时间="时间待定", 客票状态="未使用")]),
    ("History test", [
        ["说明：完全虚构的测试工作簿"], [], HEADERS + ["乘机人"],
        FLIGHT + ["Synthetic passenger"],
        FLIGHT + ["Synthetic passenger"],
        row(出发时间="10:15", 到达时间="13:35") + ["Synthetic passenger"],
        row(航班号="CA1032", 出发城市="广州白云", 到达城市="北京首都", 出发时间="16:00", 到达时间="19:20") + ["Synthetic passenger"],
        row(日期="", 客票状态="已退票") + ["Synthetic passenger"],
    ]),
])
save("invalid.xls", [("Flight history", [HEADERS, row(出发城市="无法识别的虚构机场"), FLIGHT])])

save("formula.xls", [("已结束", [HEADERS, row(出发时间=xlwt.Formula("1/2"))])])
save("many-issues.xls", [("Flight history", [HEADERS] + [row(出发城市="无法识别的虚构机场") for _ in range(25)])])
