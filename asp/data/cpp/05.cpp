#include<iostream>
#include"util\util.h"
using namespace std;

void selection_sort(int niza[], dword n)
{
	for (dword i = 1; i < n; i++) {
		dword min = i;
		for (dword j = i + 1; j < n; j++)
			if (niza[j] < niza[min])
				min = j;
		if (min != i)
			swap(niza[min], niza[i]);
	}
}