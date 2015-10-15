#include<iostream>
#include"util\util.h"
using namespace std;

dword faktoriel_recursive(dword n)
{
	if (n == 1)
		return 1;
	else
		return n * faktoriel_recursive(n - 1);
}

dword faktoriel_iterative(dword n)
{
	dword ret = 1;
	for (dword i = 1; i <= n; i++)
		ret *= i;
	return ret;
}