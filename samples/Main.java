// Poly Runner 示例：Java
// 先 javac 编译，再 java -cp 运行（类名会自动从源码里解析）。

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class Main {

    record User(String name, int score) {}

    public static void main(String[] args) {
        List<User> users = List.of(
                new User("Alice", 92),
                new User("Bob", 78),
                new User("Carol", 85));

        Map<String, Integer> ranking = users.stream()
                .sorted((a, b) -> Integer.compare(b.score(), a.score()))
                .collect(Collectors.toMap(User::name, User::score));

        System.out.println("== 排名 ==");
        int rank = 1;
        for (var entry : ranking.entrySet()) {
            System.out.println(rank++ + ". " + entry.getKey() + "  " + entry.getValue());
        }

        System.out.println("\n参数: " + java.util.Arrays.toString(args));
        System.out.println("程序正常结束。");
    }
}
