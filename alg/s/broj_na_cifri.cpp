#include <iostream>
using namespace std;
 
int main()
{
    int n;
    cin >> n;
 
    int broj = 0;
 
    if (n == 0)
    {
        broj = 1;
 
        cout << broj << endl;
        return 0;
    }
 
    //inaku
    while (n > 0)
    {
        broj++;
        n = n / 10;
    }
 
    cout << broj << endl;
    return 0;
}