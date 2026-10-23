#!/usr/bin/env python3
"""Poly Runner 示例：Python。

在 VS Code 里打开本文件，按 Cmd+Alt+N (Windows: Ctrl+Alt+N) 运行。
"""

import sys
from dataclasses import dataclass


@dataclass
class Book:
    title: str
    author: str
    price: float


BOOKS = [
    Book("三体", "刘慈欣", 59.0),
    Book("活着", "余华", 45.0),
    Book("百年孤独", "加西亚·马尔克斯", 78.5),
]


def main() -> int:
    print("== 书单 ==")
    for index, book in enumerate(sorted(BOOKS, key=lambda b: b.price), start=1):
        print(f"{index}. {book.title} — {book.author} — ¥{book.price:.2f}")

    print("\n试试传入参数：", sys.argv[1:])
    print("程序正常结束。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
