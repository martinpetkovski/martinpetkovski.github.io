/*
 * title: Fizz Buzz
 * statement:
 * Given an integer n, return the strings for the numbers from 1 through n. Replace multiples of 3 with "Fizz",
 * multiples of 5 with "Buzz", and multiples of both 3 and 5 with "FizzBuzz".
 *
 * leetcode: https://leetcode.com/problems/fizz-buzz/
 * difficulty: Easy
 * tags: Math, String, Simulation
 * time: O(n)
 * space: O(n)
 * tests:
 * n = 3 -> ["1","2","Fizz"]
 * n = 5 -> ["1","2","Fizz","4","Buzz"]
 * n = 15 -> ["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]
 * note:
 */

#include <string>
#include <vector>

class Solution
{
public:
	std::vector<std::string> fizzBuzz(int N)
	{
		std::vector<std::string> Answer;

		for (int Index = 1; Index <= N; Index++)
		{
			if (Index % 15 == 0)
				Answer.push_back("FizzBuzz");
			else if (Index % 3 == 0)
				Answer.push_back("Fizz");
			else if (Index % 5 == 0)
				Answer.push_back("Buzz");
			else
				Answer.push_back(NumberToString(Index));
		}

		return Answer;
	}

private:
	std::string NumberToString(int Number) const
	{
		char Digits[10];
		int Length = 0;

		while (Number > 0)
		{
			Digits[Length] = static_cast<char>('0' + Number % 10);
			Number /= 10;
			Length++;
		}

		std::string Result;

		while (Length > 0)
		{
			--Length;
			Result += Digits[Length];
		}

		return Result;
	}
};
