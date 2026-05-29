/*
 * title: Fizz Buzz
 * leetcode: https://leetcode.com/problems/fizz-buzz/
 * difficulty: Easy
 * tags: Math, String, Simulation
 * approach:
 * Build the answer from 1 to n. For each number, append Fizz when divisible by 3 and Buzz when divisible by 5.
 * If neither word applies, convert the number to text manually.
 *
 * time: O(n)
 * space: O(n)
 * tests:
 * n = 3 -> ["1","2","Fizz"]
 * n = 5 -> ["1","2","Fizz","4","Buzz"]
 * n = 15 -> ["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]
 */

#include <string>
#include <vector>

class Solution {
public:
    std::vector<std::string> fizzBuzz(int n) {
        std::vector<std::string> answer;

        for (int i = 1; i <= n; ++i) {
            if (i % 15 == 0) {
                answer.push_back("FizzBuzz");
            } else if (i % 3 == 0) {
                answer.push_back("Fizz");
            } else if (i % 5 == 0) {
                answer.push_back("Buzz");
            } else {
                answer.push_back(numberToString(i));
            }
        }

        return answer;
    }

private:
    std::string numberToString(int number) {
        char digits[10];
        int length = 0;

        while (number > 0) {
            digits[length] = static_cast<char>('0' + number % 10);
            number /= 10;
            ++length;
        }

        std::string result;

        while (length > 0) {
            --length;
            result += digits[length];
        }

        return result;
    }
};
