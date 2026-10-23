// Poly Runner 示例程序
// 在 VS Code 中打开本文件，按 Cmd+Alt+N (Windows: Ctrl+Alt+N) 即可编译并运行。

#include <iostream>
#include <string>
#include <vector>
#include <algorithm>

namespace {

// 一个简单的类，用来演示 C++17 特性
class Student {
public:
    Student(std::string name, int score) : name_(std::move(name)), score_(score) {}

    const std::string& name() const { return name_; }
    int score() const { return score_; }

private:
    std::string name_;
    int score_;
};

}  // namespace

int main() {
    std::vector<Student> students{
        {"Alice", 92},
        {"Bob", 78},
        {"Carol", 85},
        {"Dave", 59},
    };

    std::sort(students.begin(), students.end(),
              [](const Student& a, const Student& b) { return a.score() > b.score(); });

    std::cout << "== 成绩排名 ==" << std::endl;
    int rank = 1;
    for (const auto& s : students) {
        std::cout << rank++ << ". " << s.name() << "  " << s.score() << std::endl;
    }

    // 演示标准输入交互：程序会在终端里等待输入
    std::cout << "\n请输入一个数字（回车结束）：" << std::flush;
    int n = 0;
    if (std::cin >> n) {
        std::cout << "你输入的是 " << n << "，它的平方是 " << 1LL * n * n << std::endl;
    } else {
        std::cout << "没有读到有效输入。" << std::endl;
    }

    std::cout << "\n程序正常结束。" << std::endl;
    return 0;
}
