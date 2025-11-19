#include<iostream>
using namespace std;

int fibonachi_recursive(int n)
{
	if (n == 0)
		return 0;
	if (n == 1)
		return 1;
	return fibonachi_recursive(n - 1) + fibonachi_recursive(n - 2);
}

int fibonachi_iterative(int n)
{
	int a = 0, b = 1, c = 1;
	for (int i = 0; i < n; i++)
	{
		a = b;
		b = c;
		c = a + b;
	}
	return a;
}