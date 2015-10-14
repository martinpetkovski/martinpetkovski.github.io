#include<iostream>
#include"util\util.h"
using namespace std;

void selection_sort(int niza[], dword n)
{
	for (dword i = 0; i < n - 1; i++)
		for (dword j = i; j < n; j++)
			if (niza[i] > niza[j])
				swap(niza[i], niza[j]);
}