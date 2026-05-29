/*
 * title: Valid Palindrome
 * leetcode: https://leetcode.com/problems/valid-palindrome/
 * difficulty: Easy
 * tags: Two Pointers, String
 * approach:
 * Keep one pointer at each end of the string. Move each pointer inward until it points at an alphanumeric character,
 * then compare manually lowercased characters. If any pair differs, the string is not a palindrome.
 *
 * time: O(n)
 * space: O(1)
 */

#include <string>

class Solution {
public:
    bool isPalindrome(std::string s) {
        int left = 0;
        int right = static_cast<int>(s.size()) - 1;

        while (left < right) {
            while (left < right && !isAlphanumeric(s[left])) {
                ++left;
            }

            while (left < right && !isAlphanumeric(s[right])) {
                --right;
            }

            if (normalizeCharacter(s[left]) != normalizeCharacter(s[right])) {
                return false;
            }

            ++left;
            --right;
        }

        return true;
    }

private:
    bool isAlphanumeric(char value) {
        return ('0' <= value && value <= '9') ||
            ('a' <= value && value <= 'z') ||
            ('A' <= value && value <= 'Z');
    }

    char normalizeCharacter(char value) {
        if ('A' <= value && value <= 'Z') {
            return static_cast<char>(value - 'A' + 'a');
        }

        return value;
    }
};
